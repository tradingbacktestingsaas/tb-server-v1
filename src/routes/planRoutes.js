import express from "express";
import { plansController } from "../controllers/plansController.js";
import auth from "../middlewares/auth.js";

const router = express.Router();
router.post("/create", plansController.createPlans);
router.get("/get", plansController.getPlans);

export default router;
