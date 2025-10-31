import UserSubscription from "../models/user_subscription.model.js";
import Plans from "../models/plan.model.js";
import Users from "../models/user.model.js";
import Order from "../models/order.model.js";
import stripeService from "./stripeService.js";
import { createFreeTradeAcc } from "./tradeAccService.js";
import { Op, Sequelize, where } from "sequelize";

export async function subscribe(subscriptionDetails) {
  try {
    // Validate input
    const userId = subscriptionDetails.user_id || subscriptionDetails.userId;
    const planId = subscriptionDetails.plan_id || subscriptionDetails.planId;
    const paymentMethodId = subscriptionDetails.paymentMethodId;

    if (!userId || !planId || !paymentMethodId) {
      return {
        code: 400,
        success: false,
        message: "Missing required fields: userId, planId, paymentMethodId",
        data: null,
      };
    }

    // Fetch user and plan
    const [user, plan] = await Promise.all([
      Users.findByPk(userId),
      Plans.findByPk(planId),
    ]);

    if (!user) {
      return {
        code: 404,
        success: false,
        message: "User not found",
        data: null,
      };
    }
    if (!plan) {
      return {
        code: 404,
        success: false,
        message: "Plan not found",
        data: null,
      };
    }

    // Check for existing active subscription for this user and cancel it before creating a new one
    const existingActive = await UserSubscription.findOne({
      where: {
        userId: user.id,
        status: "active",
      },
    });

    if (existingActive && existingActive.provider_sub_id) {
      try {
        console.log(
          "Canceling existing active subscription:",
          existingActive.provider_sub_id
        );
        await stripeService.cancelSubscription({
          subscriptionId: existingActive.provider_sub_id,
          cancelAtPeriodEnd: false,
        });
      } catch (e) {
        console.error("Stripe cancel subscription failed:", e?.message || e);
      }
      // Mark local record as canceled
      await existingActive.update({
        status: "canceled",
        auto_renew: false,
        current_period_end: new Date(),
      });
    }

    // Create/Get customer in Stripe
    const customer = await stripeService.getOrCreateCustomerByEmail(
      user.email,
      [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined
    );

    // Attach payment method and set default
    await stripeService.attachPaymentMethodToCustomer(
      paymentMethodId,
      customer.id
    );

    // Create recurring price on the fly (monthly) and then create subscription
    const price = await stripeService.createRecurringPrice({
      unitAmountCents: Number(plan.price_cents),
      currency: "usd",
      productName: plan.name,
      interval: "month",
    });

    const stripeSub = await stripeService.createSubscription({
      customerId: customer.id,
      priceId: price.id,
      paymentMethodId,
    });

    // Extract invoice/payment info
    const latestInvoice = stripeSub.latest_invoice || null;
    const hostedInvoiceUrl = latestInvoice?.hosted_invoice_url || null;
    const invoiceId = latestInvoice?.id || null;
    const paymentIntent = latestInvoice?.payment_intent || null;
    const paymentId =
      typeof paymentIntent === "object"
        ? paymentIntent.id
        : paymentIntent || null;

    // Create Order
    const orderPayload = {
      userId: user.id,
      planId: plan.id,
      planCode: plan.code,
      amountSubtotalCents: Number(plan.price_cents),
      amountDiscountCents: 0,
      amountTotalCents: Number(plan.price_cents),
      currency: "USD",
      provider: "stripe",
      providerCheckoutSessionId: paymentId || null,
      status:
        latestInvoice?.status === "paid" || stripeSub.status === "active"
          ? "paid"
          : "pending",
      couponId: null,
      invoiceId: invoiceId,
      hostedInvoiceUrl: hostedInvoiceUrl,
      provider_sub_id: stripeSub.id,
      order_type: "subscription",
    };

    const order = await Order.create(orderPayload);

    // Create UserSubscription
    const periodEnd = stripeSub.current_period_end
      ? new Date(stripeSub.current_period_end * 1000)
      : null;
    const periodStart = stripeSub.current_period_start
      ? new Date(stripeSub.current_period_start * 1000)
      : new Date();

    const userSubscriptionPayload = {
      userId: user.id,
      planid: plan.id,
      plan_code: plan.code,
      status: stripeSub.status === "active" ? "active" : "pending",
      start_date: periodStart,
      current_period_end: periodEnd || new Date(),
      provider: "stripe",
      provider_sub_id: stripeSub.id,
      auto_renew: true,
    };

    // Upsert user subscription: update existing for this user, or create new if none exists
    let userSubscription = await UserSubscription.findOne({
      where: { userId: user.id },
    });
    if (userSubscription) {
      await userSubscription.update(userSubscriptionPayload);
    } else {
      userSubscription = await UserSubscription.create(userSubscriptionPayload);
    }

    // Update user plan field with plan code
    await Users.update({ plan: plan.code }, { where: { id: user.id } });

    return {
      code: 201,
      success: true,
      message: "Subscription created successfully",
      data: {
        order,
        subscription: userSubscription,
        stripe: {
          subscriptionId: stripeSub.id,
          invoiceId,
          hostedInvoiceUrl,
          paymentId,
        },
        user: user,
      },
    };
  } catch (error) {
    console.error("Error in subscribe service:", error);
    throw new Error(`Failed to create subscription: ${error}`);
  }
}

export async function createFreeSubscription(freeSubscriptionDetails) {
  try {
    const userId =
      freeSubscriptionDetails.user_id || freeSubscriptionDetails.userId;
    const planId =
      freeSubscriptionDetails.plan_id || freeSubscriptionDetails.planId;

    if (!userId || !planId) {
      return {
        code: 400,
        success: false,
        message: "Missing required fields: userId, planId",
        data: null,
      };
    }

    const [user, plan] = await Promise.all([
      Users.findByPk(userId),
      Plans.findByPk(planId),
    ]);

    if (!user) {
      return {
        code: 404,
        success: false,
        message: "User not found",
        data: null,
      };
    }
    if (!plan) {
      return {
        code: 404,
        success: false,
        message: "Plan not found",
        data: null,
      };
    }

    // Prepare free subscription payload
    const now = new Date();
    const freeSubPayload = {
      userId: user.id,
      planid: plan.id,
      plan_code: plan.code,
      status: "active",
      start_date: now,
      current_period_end: null, // free plan -> no expiry period end
      provider: null,
      provider_sub_id: null,
      auto_renew: false,
    };

    // Upsert by user: update existing record for this user, else create new
    let userSubscription = await UserSubscription.findOne({
      where: { userId: user.id },
    });
    if (userSubscription) {
      await userSubscription.update(freeSubPayload);
    } else {
      userSubscription = await UserSubscription.create(freeSubPayload);
    }

    // Update user's plan field to plan.code
    await Users.update({ plan: plan.code }, { where: { id: user.id } });

    // Create a FREE Trade Account for the user with random ACC_ prefixed accountId
    const result = await createFreeTradeAcc(user.id);
    try {
      const tradeAcc = result.tradeAccount || null;
      user.activeTradeAccountId = tradeAcc.id ;
      await user.save();
    } catch (e) {
      console.error("Failed to create free trade account:", e?.message || e);
    }

    return {
      code: 201,
      success: true,
      message: "Free subscription created successfully",
      data: {
        subscription: userSubscription,
        tradeAccount: result?.tradeAccount,
        user: user,
      },
    };
  } catch (error) {
    console.error("Error in createFreeSubscription service:", error);
    throw new Error(`Failed to create free subscription: ${error}`);
  }
}
export const subscriptionService = {
  subscribe,
  createFreeSubscription,
};
