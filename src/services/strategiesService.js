import Strategies from "../models/strategies.model.js";
import UserSubscription from "../models/user_subscription.model.js";
import Order from "../models/order.model.js";
import Users from "../models/user.model.js";
import stripeService from "./stripeService.js";
import { Op, Sequelize, where } from "sequelize";

export async function createStrategies(strategiesDetails) {
  try {
    const strategies = await Strategies.create(strategiesDetails);
    if (!strategies) {
      throw new Error("Strategies not created");
    }
    return {
      code: 201,
      message: "Strategies created successfully",
      data: strategies,
      success: true,
    };
  } catch (error) {
    console.error("Error in createStrategies service:", error);
    throw new Error(`Failed to create strategies: ${error}`);
  }
}

export async function getStrategies(query = {}) {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "created_at",
      sortOrder = "DESC",
      // filters
      id,
      status,
      type,
      isPremium,
      userId,
      purchaser_user_id,
    } = query;

    const whereClause = {};
    if (id) whereClause.id = id;
    if (status) whereClause.status = status;
    if (type) whereClause.type = type;
    if (typeof isPremium !== "undefined" && isPremium !== "") {
      // accept "true"/"false" or boolean
      whereClause.isPremium = String(isPremium).toLowerCase() === "true" || isPremium === true;
    }
    if (userId) whereClause.userId = userId;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const offset = (pageNum - 1) * limitNum;
    const order = [[sortBy, String(sortOrder).toUpperCase() === "ASC" ? "ASC" : "DESC"]];

    const { rows, count } = await Strategies.findAndCountAll({
      where: whereClause,
      offset,
      limit: limitNum,
      order,
    });

    // Determine purchased strategies for the requesting user (if provided)
    let purchasedStrategyIds = new Set();
    if (purchaser_user_id) {
      const userOrders = await Order.findAll({
        attributes: ["strategyId"],
        where: {
          userId: purchaser_user_id,
          orderType: "strategy",
          status: "paid",
        },
      });
      purchasedStrategyIds = new Set(
        userOrders
          .map((o) => o?.strategyId)
          .filter((sid) => !!sid)
      );
    }

    const dataWithPurchase = rows.map((s) => {
      const json = s.toJSON();
      json.is_purchase = purchasedStrategyIds.has(json.id);
      return json;
    });

    return {
      code: 200,
      message: "Strategies fetched successfully",
      success: true,
      data: dataWithPurchase,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum) || 1,
      },
    };
  } catch (error) {
    console.error("Error in getStrategies service:", error);
    throw new Error(`Failed to fetch strategies: ${error}`);
  }
}

export async function updateStrategies(body) {
  try {

    if (!body.id) {
      return {
        code: 400,
        message: "Strategies ID is required",
        success: false,
      };
    }
    const strategies = await Strategies.update(body, {
      where: { id: body.id },
    });
    if (!strategies) {
      throw new Error("Strategies not updated");
    }
    return {
      code: 200,
      message: "Strategies updated successfully",
      data: strategies,
      success: true,
    };
  } catch (error) {
    console.error("Error in updateStrategies service:", error);
    throw new Error(`Failed to update strategies: ${error}`);
  }
}

export async function deleteStrategies(body) {
  try {
    if (!body.id) {
      return {
        code: 400,
        message: "Strategies ID is required",
        success: false,
      };
    }
    const strategies = await Strategies.destroy({
      where: { id: body.id },
    });
    if (!strategies) {
      throw new Error("Strategies not deleted");
    }
    return {
      code: 200,
      message: "Strategies deleted successfully",
      data: strategies,
      success: true,
    };
  } catch (error) {
    console.error("Error in deleteStrategies service:", error);
    throw new Error(`Failed to delete strategies: ${error}`);
  }
}

export async function buyStrategy(body) {
  try {
    const userId = body.userId || body.user_id;
    const strategyId = body.strategyId || body.id; // support body.id as strategy id per existing pattern
    const paymentMethodId = body.paymentMethodId;

    if (!userId || !strategyId || !paymentMethodId) {
      return {
        code: 400,
        message: "Missing required fields: userId, strategyId, paymentMethodId",
        success: false,
        data: null,
      };
    }

    const [user, strategy] = await Promise.all([
      Users.findByPk(userId),
      Strategies.findByPk(strategyId),
    ]);

    if (!user) {
      return { code: 404, message: "User not found", success: false, data: null };
    }
    if (!strategy) {
      return { code: 404, message: "Strategy not found", success: false, data: null };
    }
    if (!strategy.hasPrice || !strategy.price) {
      return { code: 400, message: "Strategy is not purchasable", success: false, data: null };
    }

    // Compute amount in cents
    const amountCents = Math.round(Number(strategy.price) * 100);
    const currency = String(strategy.currency || 'USD').toLowerCase();

    // Ensure a Stripe customer exists and the payment method is associated
    const customer = await stripeService.getOrCreateCustomerByEmail(
      user.email,
      [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined
    );
    try {
      await stripeService.attachPaymentMethodToCustomer(paymentMethodId, customer.id);
    } catch (e) {
      // Ignore if it's already attached to this customer
    }

    // Process payment with Stripe using Payment Intents (confirm immediately)
    const payment = await stripeService.processPayment({
      amount: amountCents,
      currency,
      payment_method: paymentMethodId,
      customerId: customer.id,
      description: `Purchase strategy: ${strategy.title}`,
      customer_email: user.email,
    });

    const isPaid = payment.status === 'succeeded';

    // Create Order entry; set requested fields to null per instruction
    const orderPayload = {
      userId: user.id,
      planId: null,
      planCode: null,
      amountSubtotalCents: amountCents,
      amountDiscountCents: 0,
      amountTotalCents: amountCents,
      currency: String(strategy.currency || 'USD').toUpperCase(),
      provider: null,
      providerCheckoutSessionId: null,
      status: isPaid ? 'paid' : 'failed',
      couponId: null,
      invoiceId: null,
      hostedInvoiceUrl: null,
      provider_sub_id: null,
      order_type: 'strategy',
      strategyId: strategy.id,
    };

    const order = await Order.create(orderPayload);

    return {
      code: 200,
      message: isPaid ? 'Strategy purchased successfully' : 'Payment failed',
      success: isPaid,
      data: {
        order,
        payment,
      },
    };
  } catch (error) {
    console.error("Error in buyStrategy service:", error);
    throw new Error(`Failed to buy strategy: ${error}`);
  }
}

export const strategiesService = {
  createStrategies,
  getStrategies,
  updateStrategies,
  deleteStrategies,
  buyStrategy,
};
