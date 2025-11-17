import { tradeAccController } from "../controllers/tradeAccController.js";
import express from "express";
const router = express.Router();

// Authentication routes
router.get("/get", tradeAccController.getTradeAcc);
router.get("/status/:id", tradeAccController.getAccountStatus);
router.get("/get-one", tradeAccController.getTradeAccById);
router.post("/create", tradeAccController.createTradeAcc);
router.patch("/update/:id", tradeAccController.updateTradeAcc);
router.delete("/delete/:id", tradeAccController.deleteTradeAcc);
router.get("/brokers", tradeAccController.getBrokers);
// router.get("/broker-servers", tradeAccController.getBrokersServer);
router.patch("/switch", tradeAccController.switchTradeAcc);
router.get("/active", tradeAccController.activeTradeAcc);
router.post("/bulk-create", tradeAccController.bulkCreateTradeAcc);
router.delete("/bulk-delete", tradeAccController.bulkDeleteTradeAcc);

export default router;
