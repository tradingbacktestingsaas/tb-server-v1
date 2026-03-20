import express from "express";
import { userPersonalStrategyController } from "../controllers/userPersonalStrategyController.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

// Create a new user personal strategy
router.post(
  "/create",
  userPersonalStrategyController.createUserPersonalStrategy,
);

// Get all user personal strategies with filters and pagination
router.get("/get", userPersonalStrategyController.getUserPersonalStrategies);

// Get a specific user personal strategy by ID
router.get("/:id", userPersonalStrategyController.getUserPersonalStrategyById);

// Update a user personal strategy
router.patch(
  "/update",
  userPersonalStrategyController.updateUserPersonalStrategy,
);

// Delete a user personal strategy
router.delete(
  "/delete/:id",
  userPersonalStrategyController.deleteUserPersonalStrategy,
);

// Get all strategies for a specific user
router.get(
  "/user/:userId",
  userPersonalStrategyController.getUserStrategiesByUserId,
);

export default router;
