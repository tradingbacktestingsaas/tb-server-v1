import express from "express";
import auth from "../middlewares/auth.js";
import { authController } from "../controllers/authController.js";
import { recaptchaV2 } from "../middlewares/recaptcha.js";
const router = express.Router();

// Authentication routes
router.post("/register",  authController.register);
router.post("/login",  authController.login);
router.post("/google-login",  authController.googleLogin);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.post("/admin-register", authController.adminRegister);
router.post("/admin-login", authController.adminLogin);
router.post("/logout", authController.logout);
router.get(
  "/verification",
  auth(["user", "admin"]),
  authController.verifyUserJWT
);

export default router;
