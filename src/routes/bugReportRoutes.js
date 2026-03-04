import express from "express";
import { bugReportController } from "../controllers/bugReportController.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

// Create a new bug report
router.post(
  "/create",
  auth(["user", "admin"]),
  bugReportController.createBugReport,
);

// Get all bug reports (admin only)
router.get("/get", auth(["admin"]), bugReportController.getBugReports);

// Get bug report by ID
router.get(
  "/get/:id",
  auth(["user", "admin"]),
  bugReportController.getBugReportById,
);

// Get user's own bug reports
router.get(
  "/user/:userId",
  auth(["user", "admin"]),
  bugReportController.getUserBugReports,
);

// Update bug report
router.patch(
  "/update/:id",
  auth(["user", "admin"]),
  bugReportController.updateBugReport,
);

// Delete bug report
router.delete(
  "/delete/:id",
  auth(["user", "admin"]),
  bugReportController.deleteBugReport,
);

export default router;
