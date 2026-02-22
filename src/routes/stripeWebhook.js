import express from "express";
import Stripe from "stripe";
import config from "../config/env.js";
import stripeService from "../services/stripeService.js";

const router = express.Router();
const stripe = new Stripe(config.stripe.secretKey);

// ⚠️ Stripe requires the raw body to verify signatures
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
      console.error("❌ Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // ✅ Event verified — handle event types here (no DB ops)
    try {
      await stripeService.handleStripeEvents(event);
      res.status(200).json({ received: true });
    } catch (err) {
      console.error("⚠️ Error handling event:", err);
      res.status(500).send("Webhook handler error");
    }
  },
);


export default router;
