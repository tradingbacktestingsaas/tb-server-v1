import express from "express";
import { tradeController } from "../controllers/tradeController.js";
import auth from "../middlewares/auth.js";

const router = express.Router();
router.post("/create", tradeController.createTrade);
router.get("/get", tradeController.getTrades);
router.get("/journal", tradeController.getTradeJournal);
router.post("/update", tradeController.updateTrade);
router.delete("/delete/:id", tradeController.deleteTrade);
router.delete("/bulk-delete", tradeController.bulkDeleteTrade);
router.post("/bulk-create", tradeController.bulkCreateTrade);

export default router;
