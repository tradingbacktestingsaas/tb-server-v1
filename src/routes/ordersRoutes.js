import express from "express";
import { OrdesController } from "../controllers/ordersController.js";

const router = express.Router();
router.get("/get", OrdesController.getOrders);

export default router;
