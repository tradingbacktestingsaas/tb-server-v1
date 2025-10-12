import express from "express";
import { tradeController } from "../controllers/tradeController.js";
import auth from "../middlewares/auth.js";

const router = express.Router();
router.post("/create", tradeController.createTrade);
router.get("/get", tradeController.getTrades);
router.patch("/update", tradeController.updateTrade);
router.delete("/delete", tradeController.deleteTrade);
router.delete("/bulk-delete", tradeController.bulkDeleteTrade);

export default router;
