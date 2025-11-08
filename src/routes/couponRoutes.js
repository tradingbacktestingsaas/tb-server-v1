
import express from "express";
import { couponController } from "../controllers/couponsController.js";

const router = express.Router();

router.post("/create", couponController.createCoupon);
router.get("/get/:id", couponController.getCoupon);
router.get("/get", couponController.getCoupons);
router.put("/update", couponController.updateCoupon);
router.delete("/delete/:id", couponController.deleteCoupon);
router.post("/bulk-delete", couponController.bulkDelete);
router.post("/validate", couponController.validateCoupon);

export default router;
