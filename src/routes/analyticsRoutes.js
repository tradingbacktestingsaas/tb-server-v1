import express from "express";
import { analyticsController } from "../controllers/analyticsController.js";

const router = express.Router();
router.get("/get/:id", analyticsController.dashboardAnalytics);
router.get("/leaderboard", analyticsController.leaderBoard);

export default router;
