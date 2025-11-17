import Strategies from "../models/strategies.model.js";
import UserSubscription from "../models/user_subscription.model.js";
import Order from "../models/order.model.js";
import Users from "../models/user.model.js";
import stripeService from "./stripeService.js";
import { Op, Sequelize, where } from "sequelize";
import User from "../models/user.model.js";
import PurchasedStrategies from "../models/purchased_strategies.model.js";
import { createNotification } from "./notificationService.js";

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

export async function getPurchasedStrategies(id, user_id) {
  let where = {};
  try {
    if (id) {
      where.strategyId = id;
    }

    if (user_id) {
      where.userId = user_id;
    }

    const strategies = await PurchasedStrategies.findAll({ where });
    if (!strategies) {
      return {
        code: 201,
        message: "Strategies not created",
        data: [],
        success: true,
      };
    }
    return {
      code: 201,
      message: "Strategies created successfully",
      data: strategies,
      success: true,
    };
  } catch (error) {
    console.error("Error in getPurchasedStrategies service:", error);
    throw new Error(`Failed to get strategies: ${error}`);
  }
}

export async function getStrategies(query = {}) {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "created_at",
      sortOrder = "DESC",
      filters = {},
      purchaser_user_id,
    } = query;

    const { id, status, type, isPremium, userId, byUserId } = filters;

    // 1️⃣ Fetch user plan if userId is provided
    let userPlan = null;
    if (userId) {
      const user = await User.findByPk(userId);
      userPlan = user?.plan || null;
    }

    // 2️⃣ Build where clause
    const whereClause = {};

    if (id) whereClause.id = id;
    if (status) whereClause.status = status;

    if (typeof isPremium !== "undefined" && isPremium !== "") {
      whereClause.isPremium = [true, "true"].includes(
        isPremium === true ? true : String(isPremium).toLowerCase()
      );
    }

    if (userPlan === "ELITE") {
      if (type === "ELITE") {
        whereClause.type = "ELITE";
      } else if (type) {
        whereClause.type = type;
      }
    } else {
      // Non-ELITE users
      if (type === "PERSONAL") {
        whereClause.type = "PERSONAL";
        whereClause.userId = userId;
      } else {
        whereClause.type = { [Op.ne]: "ELITE" };
      }
    }

    // ❗ Always hide PERSONAL strategies from other users
    if (userId) {
      whereClause[Op.or] = [
        { type: { [Op.ne]: "PERSONAL" } }, // allow all non-personal strategies
        { userId: userId }, // allow only MY personal strategies
      ];
    }

    if (byUserId) whereClause.userId = byUserId;

    // 3️⃣ Pagination & sorting
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    const order = [
      [sortBy, String(sortOrder).toUpperCase() === "ASC" ? "ASC" : "DESC"],
    ];

    // 4️⃣ Fetch strategies
    const { rows, count } = await Strategies.findAndCountAll({
      where: whereClause,
      offset,
      limit: limitNum,
      order,
    });

    // 5️⃣ Fetch purchased strategy IDs if purchaser_user_id provided
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
        userOrders.map((o) => o.strategyId).filter(Boolean)
      );
    }

    // 6️⃣ Mark purchased strategies
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
    throw new Error(`Failed to fetch strategies: ${error.message || error}`);
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
      return {
        code: 404,
        message: "User not found",
        success: false,
        data: null,
      };
    }
    if (!strategy) {
      return {
        code: 404,
        message: "Strategy not found",
        success: false,
        data: null,
      };
    }
    if (!strategy.hasPrice || !strategy.price) {
      return {
        code: 400,
        message: "Strategy is not purchasable",
        success: false,
        data: null,
      };
    }

    // Compute amount in cents
    const amountCents = Math.round(Number(strategy.price) * 100);
    const currency = String(strategy.currency || "USD").toLowerCase();

    // Ensure a Stripe customer exists and the payment method is associated
    const customer = await stripeService.getOrCreateCustomerByEmail(
      user.email,
      [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined
    );
    try {
      await stripeService.attachPaymentMethodToCustomer(
        paymentMethodId,
        customer.id
      );
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

    const isPaid = payment.status === "succeeded";

    // Create Order entry; set requested fields to null per instruction
    const orderPayload = {
      userId: user.id,
      planId: null,
      planCode: null,
      amountSubtotalCents: amountCents,
      amountDiscountCents: 0,
      amountTotalCents: amountCents,
      currency: String(strategy.currency || "USD").toUpperCase(),
      provider: null,
      providerCheckoutSessionId: null,
      status: isPaid ? "paid" : "failed",
      couponId: null,
      invoiceId: null,
      hostedInvoiceUrl: null,
      provider_sub_id: null,
      order_type: "strategy",
      strategyId: strategy.id,
    };

    const order = await Order.create(orderPayload);
    await createNotification({
      userId: order.userId,
      title: "Your subscription ist started!",
      type: "alert",
      message:
        "Your subscription is now active. You can start connecting your live accounts.",
    });
    const purchasedStrategy = await PurchasedStrategies.create({
      userId: user.id,
      strategyId: strategy.id,
    });

    return {
      code: 200,
      message: isPaid ? "Strategy purchased successfully" : "Payment failed",
      success: isPaid,
      data: {
        order,
        payment,
        purchasedStrategy,
      },
    };
  } catch (error) {
    console.error("Error in buyStrategy service:", error);
    throw new Error(`Failed to buy strategy: ${error}`);
  }
}

const bulkCreateStrategy = async (details) => {
  try {
    if (!details) {
      throw new Error("Trade account details not found");
    }

    const tradeAccs = await Strategies.bulkCreate(details, {
      validate: true,
      returning: true,
      ignoreDuplicates: true,
    });

    if (!tradeAccs) {
      throw new Error("Trade accounts not created");
    }

    return {
      message: "Trade accounts created successfully",
      data: tradeAccs,
      success: true,
    };
  } catch (error) {
    console.error("Error in bulkCreateTradeAccs service:", error);
    throw new Error(`Failed to create trade accounts: ${error}`);
  }
};

export const strategiesService = {
  createStrategies,
  getStrategies,
  updateStrategies,
  deleteStrategies,
  buyStrategy,
  bulkCreateStrategy,
  getPurchasedStrategies,
};
