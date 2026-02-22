import config from "../config/env.js";
import { authService } from "../services/authService.js";

const register = async (req, res) => {
  try {
    const response = await authService.register(req.body);
    return res.status(response.code).json(response);
  } catch (error) {
    return res.status(error?.status || 500).json({
      code: error?.status || 500,
      success: false,
      message: error?.message || "Internal server error",
      data: null,
    });
  }
};

const login = async (req, res) => {
  try {
    const response = await authService.login(req.body);

    if (response.token) {
      const isProd = process.env.NODE_ENV === "production";

      res.cookie("accessToken", response.token, {
        httpOnly: true,
        domain: isProd ? ".tradingbacktesting.com" : undefined,
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: isProd ? "none" : "lax",
        secure: isProd,
      });
    }

    return res.status(response.code).json(response);
  } catch (error) {
    return res.status(error?.status || 500).json({
      code: error?.status || 500,
      success: false,
      message: error?.message || "Internal server error",
      data: null,
    });
  }
};

const logout = async (req, res) => {
  try {
    res.clearCookie("accessToken");

    const response = await authService.logout();
    return res.status(response.code).json(response);
  } catch (error) {
    return res.status(error?.status || 500).json({
      code: error?.status || 500,
      success: false,
      message: error?.message || "Internal server error",
      data: null,
    });
  }
};

const googleLogin = async (req, res) => {
  try {
    const response = await authService.googleLogin(req.body);

    if (response.token) {
      const isProd = process.env.NODE_ENV === "production";

      res.cookie("accessToken", response.token, {
        httpOnly: true,
        domain: isProd ? ".tradingbacktesting.com" : undefined,
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: isProd ? "none" : "lax",
        secure: isProd,
      });
    }

    return res.status(response.code).json(response);
  } catch (error) {
    return res.status(error?.status || 500).json({
      code: error?.status || 500,
      success: false,
      message: error?.message || "Internal server error",
      data: null,
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const response = await authService.forgotPassword(req.body.email);
    return res.status(response.code).json(response);
  } catch (error) {
    return res.status(error?.status || 500).json({
      code: error?.status || 500,
      success: false,
      message: error?.message || "Internal server error",
      data: null,
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const response = await authService.resetPassword(req.body);
    return res.status(response.code).json(response);
  } catch (error) {
    return res.status(error?.status || 500).json({
      code: error?.status || 500,
      success: false,
      message: error?.message || "Internal server error",
      data: null,
    });
  }
};

const adminRegister = async (req, res) => {
  try {
    const response = await authService.adminRegister(req.body);
    return res.status(response.code).json(response);
  } catch (error) {
    return res.status(error?.status || 500).json({
      code: error?.status || 500,
      success: false,
      message: error?.message || "Internal server error",
      data: null,
    });
  }
};

const adminLogin = async (req, res) => {
  try {
    const response = await authService.adminLogin(req.body);

    if (response.token) {
      const isProd = config.env === "production";

      res.cookie("accessToken", response.token, {
        httpOnly: true,
        domain: isProd ? ".tradingbacktesting.com" : undefined,
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: isProd ? "none" : "lax",
        secure: isProd,
      });
    }

    return res.status(response.code).json(response);
  } catch (error) {
    return res.status(error?.status || 500).json({
      code: error?.status || 500,
      success: false,
      message: error?.message || "Internal server error",
      data: null,
    });
  }
};

const verifyUserJWT = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        code: 401,
        success: false,
        message: "User not verified or token invalid",
        data: null,
      });
    }

    return res.status(200).json({
      code: 200,
      success: true,
      message: "User verified successfully",
      data: {
        id: req.user.id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        role: req.user.role,
        plan: req.user.plan,
        avatar_url: req.user.avatar_url,
        blocked: req.user.blocked,
        subscriptions: req.user.subscriptions,
        tradeAccounts: req.user.tradeAccounts,
      },
    });
  } catch (error) {
    return res.status(error?.status || 500).json({
      code: error?.status || 500,
      success: false,
      message: error?.message || "Internal server error",
      data: null,
    });
  }
};

export const authController = {
  register,
  login,
  forgotPassword,
  resetPassword,
  adminRegister,
  adminLogin,
  verifyUserJWT,
  googleLogin,
  logout,
};