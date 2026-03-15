import express from "express";
import Stripe from "stripe";
import config from "../config/env.js";
import stripeService from "../services/stripeService.js";
import TradeAccount from "../models/trade_account.model.js";
import { createNotification } from "../services/notificationService.js";

const router = express.Router();
const stripe = new Stripe(config.stripe.secretKey);

function getAccountStatusByEvent(eventName) {
  switch (eventName) {
    case "connected":
      return "CONNECTED";
    case "not_connected":
      return "NOT_CONNECTED";
    case "reconnected":
      return "RECONNECTED";
    case "out_of_sync":
      return "OUT_OF_SYNC";
    case "in_sync":
      return "IN_SYNC";
    case "equity_alert":
      return "EQUITY_ALERT";
    default:
      return "UNKNOWN";
  }
}

function getAccountActiveByEvent(eventName) {
  switch (eventName) {
    case "connected":
    case "reconnected":
    case "in_sync":
      return true;
    case "not_connected":
    case "out_of_sync":
      return false;
    default:
      return undefined;
  }
}

async function syncTradeSyncAccountState(accountEvent) {
  try {
    const accountId = accountEvent?.account_id;

    if (!accountId) {
      return null;
    }

    const tradeAccount = await TradeAccount.findOne({
      where: { tradesyncId: String(accountId) },
      attributes: ["id", "userId", "tradesyncId", "token", "isActive"],
    });

    if (!tradeAccount) {
      console.warn(
        `⚠️ No local account found for TradeSync account ${String(accountId)}`,
      );
      return null;
    }

    const mappedStatus = getAccountStatusByEvent(accountEvent.event);
    const activeState = getAccountActiveByEvent(accountEvent.event);

    const updatePayload = {
      token: String(accountEvent?.status || mappedStatus),
    };

    if (typeof activeState === "boolean") {
      updatePayload.isActive = activeState;
    }

    await tradeAccount.update(updatePayload);

    return tradeAccount;
  } catch (error) {
    console.error("❌ Failed to sync TradeSync account status:", error);
    return null;
  }
}

async function notifyTradeSyncAccountEvent(
  accountEvent,
  title,
  message,
  tradeAccount,
) {
  try {
    const resolvedAccount =
      tradeAccount ||
      (await TradeAccount.findOne({
        where: { tradesyncId: String(accountEvent?.account_id) },
        attributes: ["id", "userId", "tradesyncId"],
      }));

    if (!resolvedAccount?.userId) {
      console.warn(
        `⚠️ No local user found for TradeSync account ${String(accountEvent?.account_id)}`,
      );
      return;
    }

    await createNotification({
      userId: resolvedAccount.userId,
      title,
      type: "alert",
      message,
      data: {
        kind: "tradesync-webhook",
        accountId: accountEvent.account_id,
        event: accountEvent.event,
        eventId: accountEvent.event_id || null,
        createdAt: accountEvent.created_at || null,
        updatedAt: accountEvent.updated_at || null,
      },
    });
  } catch (error) {
    console.error("❌ Failed to send TradeSync user notification:", error);
  }
}

/* =========================================================
   STRIPE WEBHOOK
   ========================================================= */
router.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        config.stripe.webhookSecret,
      );
    } catch (err) {
      console.error("❌ Stripe signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      await stripeService.handleStripeEvents(event);
      return res.status(200).json({ received: true });
    } catch (err) {
      console.error("⚠️ Stripe handler error:", err);
      return res.status(500).send("Webhook handler error");
    }
  },
);

/* =========================================================
   TRADESYNC WEBHOOK
   ========================================================= */
router.post("/tradesync", express.json(), async (req, res) => {
  try {
    const payload = req.body;

    console.log("📩 TradeSync webhook received:", payload);

    if (payload?.result && payload.result !== "success") {
      return res.status(400).send("Invalid payload");
    }

    const accountEvent = payload?.data?.event
      ? payload.data
      : payload?.data || payload;

    if (!accountEvent?.event) {
      return res.status(400).send("Invalid payload");
    }

    const tradeAccount = await syncTradeSyncAccountState(accountEvent);

    switch (accountEvent.event) {
      case "connected":
        console.log(`✅ Account ${accountEvent.account_id} connected`);
        await notifyTradeSyncAccountEvent(
          accountEvent,
          "Trade account connected",
          `Account ${accountEvent.account_id} is now connected.`,
          tradeAccount,
        );
        break;

      case "not_connected":
        console.log(`❌ Account ${accountEvent.account_id} not connected`);
        await notifyTradeSyncAccountEvent(
          accountEvent,
          "Trade account disconnected",
          `Account ${accountEvent.account_id} is not connected.`,
          tradeAccount,
        );
        break;

      case "reconnected":
        console.log(`🔁 Account ${accountEvent.account_id} reconnected`);
        await notifyTradeSyncAccountEvent(
          accountEvent,
          "Trade account reconnected",
          `Account ${accountEvent.account_id} has reconnected.`,
          tradeAccount,
        );
        break;

      case "out_of_sync":
        console.log(`⚠️ Account ${accountEvent.account_id} out of sync`);
        await notifyTradeSyncAccountEvent(
          accountEvent,
          "Trade account out of sync",
          `Account ${accountEvent.account_id} is out of sync.`,
          tradeAccount,
        );
        break;

      case "in_sync":
        console.log(`🔄 Account ${accountEvent.account_id} back in sync`);
        await notifyTradeSyncAccountEvent(
          accountEvent,
          "Trade account back in sync",
          `Account ${accountEvent.account_id} is back in sync.`,
          tradeAccount,
        );
        break;

      case "equity_alert":
        console.log(`💰 Equity alert on account ${accountEvent.account_id}`);
        await notifyTradeSyncAccountEvent(
          accountEvent,
          "Trade account equity alert",
          `Equity alert triggered for account ${accountEvent.account_id}.`,
          tradeAccount,
        );
        break;

      default:
        console.log("⚠️ Unknown event:", accountEvent.event);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("TradeSync webhook error:", error);
    return res.status(500).send("Server error");
  }
});

export default router;
