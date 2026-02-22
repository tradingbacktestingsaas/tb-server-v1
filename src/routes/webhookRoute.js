import express from "express";
import Stripe from "stripe";
import config from "../config/env.js";
import stripeService from "../services/stripeService.js";

const router = express.Router();
const stripe = new Stripe(config.stripe.secretKey);

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
    const event = req.body;

    console.log("📩 TradeSync webhook received:", event);

    if (event.result !== "success") {
      return res.status(400).send("Invalid payload");
    }

    const accountEvent = event.data;

    switch (accountEvent.event) {
      case "connected":
        console.log(`✅ Account ${accountEvent.account_id} connected`);
        break;

      case "not_connected":
        console.log(`❌ Account ${accountEvent.account_id} not connected`);
        break;

      case "reconnected":
        console.log(`🔁 Account ${accountEvent.account_id} reconnected`);
        break;

      case "out_of_sync":
        console.log(`⚠️ Account ${accountEvent.account_id} out of sync`);
        break;

      case "in_sync":
        console.log(`🔄 Account ${accountEvent.account_id} back in sync`);
        break;

      case "equity_alert":
        console.log(`💰 Equity alert on account ${accountEvent.account_id}`);
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
