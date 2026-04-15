import Stripe from "stripe";
import config from "../config/env.js";
import BillingCustomer from "../models/billing_customer.model.js";
import Order from "../models/order.model.js";
import User from "../models/user.model.js";
import UserSubscription from "../models/user_subscription.model.js";
import Plans from "../models/plan.model.js";
import { createFreeTradeAcc } from "./tradeAccService.js";
import Coupon from "../models/coupon.model.js";
import { sendSubscriptionUpdate } from "./subscriptionUpdateService.js";

// Initialize Stripe with the API key
const stripe = new Stripe(config.stripe.secretKey);
export const ensureStripeCustomer = async (userId) => {
  const existing = await BillingCustomer.findOne({
    where: { userId },
    include: [
      {
        model: User,
        as: "userInfo",
        attributes: ["id", "firstName", "lastName", "email"],
      },
    ],
  });

  // If found in DB, return the customer ID
  if (existing?.stripeCustomerId) return existing.stripeCustomerId;

  //Otherwise create a new Stripe customer
  const created = await stripe.customers.create({
    metadata: { userId: String(userId) },
    email: existing?.userInfo?.email,
    name: `${existing?.userInfo?.firstName || ""} ${
      existing?.userInfo?.lastName || ""
    }`.trim(),
  });

  //Store locally in DB
  await BillingCustomer.create({
    userId,
    stripeCustomerId: created.id,
  });

  return created.id;
};

// Customer helpers
const getOrCreateCustomerByEmail = async (email, name = null) => {
  const existing = await stripe.customers.list({ email, limit: 1 });
  if (existing.data && existing.data.length > 0) return existing.data[0];
  const customer = await stripe.customers.create({
    email,
    name: name || undefined,
  });
  return customer;
};

const attachPaymentMethodToCustomer = async (paymentMethodId, customerId) => {
  await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });
  return true;
};

// Create a recurring price on the fly and a subscription
const createRecurringPrice = async ({
  unitAmountCents,
  currency = "usd",
  productName,
  interval = "month",
}) => {
  const price = await stripe.prices.create({
    unit_amount: unitAmountCents,
    currency,
    recurring: { interval },
    product_data: { name: productName },
  });
  return price;
};

const createSubscription = async ({ customerId, priceId, paymentMethodId }) => {
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_settings: {
      save_default_payment_method: "on_subscription",
      payment_method_types: ["card"],
    },
    default_payment_method: paymentMethodId,
    expand: ["latest_invoice.payment_intent", "latest_invoice"],
  });
  return subscription;
};

const createOrder = async ({
  checkoutSession,
  userId,
  total,
  planId,
  planCode,
  discount,
  cycle,
}) => {
  const createdOrder = await Order.create({
    providerCheckoutSessionId: checkoutSession,
    userId,
    amountTotalCents: total,
    amountSubtotalCents: total,
    amountDiscountCents: discount,
    planId,
    cycle: cycle,
    planCode: planCode,
    provider: "Stripe",
    status: "created",
  });
  return createdOrder;
};

const validateCoupon = async (code, plan_code) => {
  const coupon = await Coupon.findOne({
    where: { code: code, isActive: true },
  });

  if (!(coupon.appliesTo === plan_code || coupon.appliesTo === "all")) {
    return {
      code: 422,
      success: false,
      message: "Coupon not applicable to this plan",
      data: null,
    };
  }
  return coupon;
};

const createCheckoutSession = async ({
  total,
  plan_code,
  userId,
  planId,
  coupon,
  couponId,
  interval,
  discount,
}) => {
  console.log(coupon);

  const customer = await ensureStripeCustomer(userId);
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    success_url: `${config.frontendUrl}/plans/success`,
    cancel_url: `${config.frontendUrl}/plans/cancel`,
    customer: customer,
    line_items: [
      {
        price_data: {
          currency: "usd",
          recurring: { interval },
          product_data: { name: `${plan_code.toUpperCase()} Plan` },
          unit_amount: total,
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId,
      plan_code: plan_code,
      interval,
      coupon_code: coupon ?? "",
      coupon_id: couponId ?? "",
    },
  });

  const orderDetails = {
    checkoutSession: checkoutSession.id,
    userId,
    total,
    discount: discount,
    planId,
    cycle: interval,
    planCode: plan_code,
    provider: "Stripe",
    status: "created",
  };

  const createdOrder = await createOrder(orderDetails);
  if (!createdOrder) {
    return {
      code: 500,
      success: false,
      message: "Failed to create order",
      data: null,
    };
  }
  return checkoutSession;
};

// Cancel a subscription (immediately or at period end)
const cancelSubscription = async ({
  subscriptionId,
  cancelAtPeriodEnd = false,
}) => {
  if (!subscriptionId) {
    throw new Error("subscriptionId is required to cancel a subscription");
  }
  if (cancelAtPeriodEnd) {
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }
  return await stripe.subscriptions.cancel(subscriptionId);
};

/**
 * Create a payment method with Stripe
 * @param {Object} paymentData - Payment method data
 * @returns {Promise<Object>} - Stripe setup intent with client secret
 */
const createSetupIntent = async () => {
  try {
    // Create a SetupIntent instead of directly handling card details
    // This is the secure approach recommended by Stripe
    const setupIntent = await stripe.setupIntents.create({
      usage: "off_session", // Allow the payment method to be used for future payments
    });

    return {
      clientSecret: setupIntent.client_secret,
      id: setupIntent.id,
    };
  } catch (error) {
    // Handle Stripe-specific errors
    const customError = new Error(
      error.message || "Failed to create setup intent",
    );
    customError.statusCode = error.statusCode || 500;
    customError.stripeError = error;
    throw customError;
  }
};

/**
 * Retrieve a payment method
 * @param {string} paymentMethodId - The ID of the payment method to retrieve
 * @returns {Promise<Object>} - Payment method details
 */
const retrievePaymentMethod = async (paymentMethodId) => {
  try {
    if (!paymentMethodId) {
      const error = new Error("Payment method ID is required");
      error.statusCode = 400;
      throw error;
    }

    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

    return {
      id: paymentMethod.id,
      card: paymentMethod.card
        ? {
            last4: paymentMethod.card.last4,
            brand: paymentMethod.card.brand,
            exp_month: paymentMethod.card.exp_month,
            exp_year: paymentMethod.card.exp_year,
          }
        : null,
    };
  } catch (error) {
    // Handle Stripe-specific errors
    const customError = new Error(
      error.message || "Failed to retrieve payment method",
    );
    customError.statusCode = error.statusCode || 500;
    customError.stripeError = error;
    throw customError;
  }
};

/**
 * Process a payment with Stripe using Payment Intents
 * @param {Object} paymentData - Payment data
 * @param {number} paymentData.amount - Amount in cents
 * @param {string} paymentData.currency - Currency code (e.g., 'usd')
 * @param {string} paymentData.payment_method - Payment method ID
 * @param {string} paymentData.description - Payment description
 * @param {string} paymentData.customer_email - Customer email or reference
 * @returns {Promise<Object>} - Stripe payment intent object
 */
const processPayment = async (paymentData) => {
  try {
    const {
      amount,
      currency,
      payment_method,
      description,
      customer_email,
      customerId,
    } = paymentData;

    // Create a payment intent and confirm it immediately
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      payment_method,
      description,
      confirm: true, // Confirm the payment immediately
      receipt_email: customer_email,
      return_url: "https://woowsocial.com/order/success", // URL to redirect after payment
      off_session: true, // Since we're charging without customer action
      payment_method_types: ["card"],
      capture_method: "automatic",
      ...(customerId ? { customer: customerId } : {}),
    });

    return {
      id: paymentIntent.id,
      balance_transaction: paymentIntent.latest_charge,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    };
  } catch (error) {
    // Add custom error handling for Stripe errors
    const customError = new Error(error.message || "Payment processing failed");
    customError.statusCode = error.statusCode || 500;
    customError.stripeError = error;
    throw customError;
  }
};

/**
 * Create a refund for a charge
 * @param {string} chargeId - The ID of the charge to refund
 * @param {number} amount - Amount to refund in cents (optional, refunds entire charge if not specified)
 * @returns {Promise<Object>} - Stripe refund object
 */
const createRefund = async (chargeId, amount = null) => {
  try {
    const refundData = {
      charge: chargeId,
    };

    // If amount is specified, add it to refund data
    if (amount) {
      refundData.amount = amount;
    }

    const refund = await stripe.refunds.create(refundData);
    return refund;
  } catch (error) {
    const customError = new Error(error.message || "Refund processing failed");
    customError.statusCode = error.statusCode || 500;
    customError.stripeError = error;
    throw customError;
  }
};

const handleStripeEvents = async (event) => {
  switch (event.type) {
    case "checkout.session.completed": {
      try {
        const session = event.data.object;
        if (session.mode !== "subscription") return;

        const meta = session.metadata || {};
        const userId = meta.userId;
        const planCode = meta.plan_code;
        const interval = meta.interval || null;
        const couponId = meta.coupon_id || null;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : null;

        if (!userId || !planCode || !subscriptionId) {
          console.warn(
            "Missing required metadata or subscription id for checkout.session.completed",
            {
              userId,
              planCode,
              subscriptionId,
            },
          );
          return;
        }

        const [user, plan] = await Promise.all([
          User.findByPk(userId),
          Plans.findOne({ where: { code: planCode } }),
        ]);
        if (!user || !plan) {
          console.warn(
            "User or Plan not found for webhook subscription creation",
            {
              hasUser: !!user,
              hasPlan: !!plan,
              userId,
              planCode,
            },
          );
          return;
        }

        // Retrieve subscription from Stripe for period dates
        const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
        const periodEnd = stripeSub.current_period_end
          ? new Date(stripeSub.current_period_end * 1000)
          : null;
        const periodStart = stripeSub.current_period_start
          ? new Date(stripeSub.current_period_start * 1000)
          : new Date();

        // Retrieve latest invoice details for invoiceId and hostedInvoiceUrl
        const latestInvoiceId =
          typeof stripeSub.latest_invoice === "string"
            ? stripeSub.latest_invoice
            : stripeSub.latest_invoice?.id || null;
        let hostedInvoiceUrl = null;
        if (latestInvoiceId) {
          try {
            const invoice = await stripe.invoices.retrieve(latestInvoiceId);
            hostedInvoiceUrl = invoice?.hosted_invoice_url || null;
          } catch (e) {
            console.error("Failed to retrieve invoice:", e?.message || e);
          }
        }

        // Update related order created at checkout session time
        try {
          const existingOrder = await Order.findOne({
            where: { providerCheckoutSessionId: session.id },
          });
          if (existingOrder) {
            await existingOrder.update({
              status: "paid",
              provider_sub_id: subscriptionId,
              invoiceId: latestInvoiceId || null,
              hostedInvoiceUrl: hostedInvoiceUrl,
              cycle: interval,
              couponId: couponId,
            });
          }
        } catch (e) {
          console.error(
            "Failed to update order from checkout.session.completed:",
            e?.message || e,
          );
        }

        // Upsert user subscription
        const userSubscriptionPayload = {
          userId: user.id,
          planid: plan.id,
          plan_code: plan.code,
          status: stripeSub.status === "active" ? "active" : "pending",
          start_date: periodStart,
          current_period_end: periodEnd || new Date(),
          provider: "stripe",
          provider_sub_id: subscriptionId,
          auto_renew: true,
        };
        let userSubscription = await UserSubscription.findOne({
          where: { userId: user.id },
        });
        if (userSubscription) {
          await userSubscription.update(userSubscriptionPayload);
        } else {
          userSubscription = await UserSubscription.create(
            userSubscriptionPayload,
          );
        }

        // Update user plan and ensure free trade account exists
        await User.update({ plan: plan.code }, { where: { id: user.id } });
        try {
          await createFreeTradeAcc(user.id);
        } catch (e) {
          console.error("createFreeTradeAcc failed:", e?.message || e);
        }

        // Always notify user of new subscription, regardless of trade account creation
        await sendSubscriptionUpdate({
          userId: user.id,
          title: "Subscription started",
          type: "alert",
          message:
            "Your subscription is now active. You can start connecting your live accounts.",
          emailSubject: "Your subscription is now active!",
          emailHtml: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto;">
              <h2 style="color: #2196F3;">Subscription Activated 🎉</h2>
              <p>Hello,</p>
              <p>Your <strong>${plan.name || plan.code}</strong> subscription is now active.</p>
              <p>You can now connect your live trading accounts and start backtesting.</p>
              <p style="margin-top: 24px;">Thank you for choosing Trading Backtesting Platform!</p>
            </div>
          `,
          data: {
            kind: "subscription-created",
            subscriptionId,
            planCode: plan.code,
          },
        });
      } catch (err) {
        console.error(
          "Error handling checkout.session.completed:",
          err?.message || err,
        );
      }
      break;
    }

    case "invoice.payment_succeeded": {
      try {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;
        // Update order (if any) with invoice details and mark paid
        const order = await Order.findOne({
          where: { provider_sub_id: subscriptionId },
        });
        if (order) {
          await order.update({
            status: "paid",
            invoiceId: invoice.id,
            hostedInvoiceUrl: invoice.hosted_invoice_url || null,
          });

          if (order.userId) {
            await sendSubscriptionUpdate({
              userId: order.userId,
              title: "Subscription payment successful",
              type: "info",
              message: "Your subscription payment was received successfully.",
              emailSubject: "Payment received — thank you!",
              emailHtml: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto;">
                  <h2 style="color: #4CAF50;">Payment Received ✅</h2>
                  <p>Hello,</p>
                  <p>Your subscription payment was received successfully. Your subscription remains active.</p>
                  ${invoice.hosted_invoice_url ? `<p><a href="${invoice.hosted_invoice_url}" style="color: #2196F3;">View your invoice</a></p>` : ""}
                  <p style="margin-top: 24px;">Thank you for using Trading Backtesting Platform!</p>
                </div>
              `,
              data: {
                kind: "subscription-payment-success",
                subscriptionId,
                invoiceId: invoice.id,
              },
            });
          }
        }
      } catch (err) {
        console.error(
          "Error handling invoice.payment_succeeded:",
          err?.message || err,
        );
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const subscriptionId = invoice.subscription;
      console.log("⚠️ Payment failed:", invoice.id);

      try {
        const order = await Order.findOne({
          where: { provider_sub_id: subscriptionId },
        });

        if (order?.userId) {
          await sendSubscriptionUpdate({
            userId: order.userId,
            title: "Subscription payment failed",
            type: "alert",
            message:
              "We could not process your subscription payment. Please update your payment method.",
            emailSubject: "Action required: Payment failed",
            emailHtml: `
              <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto;">
                <h2 style="color: #f44336;">Payment Failed ⚠️</h2>
                <p>Hello,</p>
                <p>We were unable to process your subscription payment. Please update your payment method to keep your subscription active.</p>
                <a href="${config.frontendUrl}/plans" style="display: inline-block; margin-top: 12px; padding: 10px 20px; background-color: #f44336; color: white; text-decoration: none; border-radius: 5px;">Update Payment Method</a>
                <p style="margin-top: 24px;">If you have any questions, please contact our support team.</p>
              </div>
            `,
            data: {
              kind: "subscription-payment-failed",
              subscriptionId,
              invoiceId: invoice.id,
            },
          });
        }
      } catch (err) {
        console.error(
          "Error handling invoice.payment_failed:",
          err?.message || err,
        );
      }
      break;
    }

    case "customer.subscription.deleted": {
      try {
        const sub = event.data.object;
        const subscriptionId = sub.id;
        const existing = await UserSubscription.findOne({
          where: { provider_sub_id: subscriptionId },
        });
        if (existing) {
          await existing.update({
            status: "canceled",
            auto_renew: false,
            current_period_end: new Date(),
          });

          await sendSubscriptionUpdate({
            userId: existing.userId,
            title: "Subscription canceled",
            type: "alert",
            message:
              "Your subscription has been canceled. You can resubscribe anytime from the plans page.",
            emailSubject: "Your subscription has been canceled",
            emailHtml: `
              <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto;">
                <h2 style="color: #FF9800;">Subscription Canceled</h2>
                <p>Hello,</p>
                <p>Your subscription has been canceled. You will retain access until the end of your current billing period.</p>
                <a href="${config.frontendUrl}/plans" style="display: inline-block; margin-top: 12px; padding: 10px 20px; background-color: #2196F3; color: white; text-decoration: none; border-radius: 5px;">Resubscribe</a>
                <p style="margin-top: 24px;">We hope to see you back soon. Thank you for using Trading Backtesting Platform!</p>
              </div>
            `,
            data: {
              kind: "subscription-canceled",
              subscriptionId,
            },
          });
        }
      } catch (err) {
        console.error(
          "Error handling customer.subscription.deleted:",
          err?.message || err,
        );
      }
      break;
    }

    // default: {
    //   console.log(`⚙️ Unhandled event type: ${event.type}`);
    // }
  }
};

const stripeService = {
  createSetupIntent,
  retrievePaymentMethod,
  processPayment,
  createRefund,
  getOrCreateCustomerByEmail,
  attachPaymentMethodToCustomer,
  createRecurringPrice,
  createSubscription,
  createCheckoutSession,
  cancelSubscription,
  handleStripeEvents,
};

export default stripeService;
