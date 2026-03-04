import express from "express";
import { feedbackController } from "../controllers/feedbackController.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

// Create a new feedback
router.post(
  "/create",
  auth(["user", "admin"]),
  feedbackController.createFeedback,
);

// Get all feedbacks (admin only)
router.get("/get", auth(["admin"]), feedbackController.getFeedbacks);

// Get feedback by ID
router.get(
  "/get/:id",
  auth(["user", "admin"]),
  feedbackController.getFeedbackById,
);

// Get user's own feedbacks
router.get(
  "/user/:userId",
  auth(["user", "admin"]),
  feedbackController.getUserFeedbacks,
);

// Update feedback
router.patch(
  "/update/:id",
  auth(["user", "admin"]),
  feedbackController.updateFeedback,
);

// Delete feedback
router.delete(
  "/delete/:id",
  auth(["user", "admin"]),
  feedbackController.deleteFeedback,
);

export default router;
