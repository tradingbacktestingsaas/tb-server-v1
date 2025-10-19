import express from "express";
import { subscriptionController } from "../controllers/subscriptionController.js";
import auth from "../middlewares/auth.js";

const router = express.Router();
router.post("/subscribe", subscriptionController.subscribe);

export default router;
