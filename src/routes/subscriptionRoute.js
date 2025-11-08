import express from "express";
import { subscriptionController } from "../controllers/subscriptionController.js";
import auth from "../middlewares/auth.js";

const router = express.Router();
// router.post("/subscribe", subscriptionController.subscribe);
router.post("/create-checkout", subscriptionController.createCheckoutSession);
router.post("/create-free-subscription", subscriptionController.createFreeSubscription);

export default router;
