import config from "../config/env.js";
import { authService } from "../services/authService.js";

const register = async (req, res) => {
  try {
    const { user, redirect } = await authService.register(req.body);
    return res.status(201).json({
      code: 201,
      success: true,
      redirect: redirect,
      message: "User registered successfully",
      data: user,
    });
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      redirect: null,
      data: null,
    });
  }
};

const login = async (req, res) => {
  try {
    const response = await authService.login(req.body);
    const isProd = process.env.NODE_ENV === "production";
    res.cookie("accessToken", response.token, {
      httpOnly: true,
      // In dev: DO NOT set domain. In prod: set your parent domain for subdomains.
      domain: isProd ? "tradingbacktesting.com" : "localhost",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,

      // Cookie site policy:
      // - If using same-origin dev (Next proxy to API): Lax is fine over HTTP
      // - If cross-site (different ports) OR you want cross-subdomain in prod: use None + Secure
      sameSite: isProd ? "none" : "lax",
      secure: isProd, // must be true when sameSite === 'none'
    });

    return res.status(200).json({
      code: 200,
      success: true,
      message: "Signin successful",
      data: response?.user,
      redirect: response?.redirect,
    });
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      jwt: null,
      data: null,
      redirect: null,
    });
  }
};

const googleLogin = async (req, res) => {
  try {
    const response = await authService.googleLogin(req.body);
    const isProd = process.env.NODE_ENV === "production";
    res.cookie("accessToken", response.token, {
      httpOnly: true,
      // In dev: DO NOT set domain. In prod: set your parent domain for subdomains.
      domain: isProd ? "tradingbacktesting.com" : "localhost",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,

      // Cookie site policy:
      // - If using same-origin dev (Next proxy to API): Lax is fine over HTTP
      // - If cross-site (different ports) OR you want cross-subdomain in prod: use None + Secure
      sameSite: isProd ? "none" : "lax",
      secure: isProd, // must be true when sameSite === 'none'
    });

    return res.status(200).json({
      code: 200,
      success: true,
      jwt: response?.token,
      message: response?.message,
      data: response?.data,
      redirect: response?.redirect,
    });
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      jwt: null,
      data: null,
      redirect: null,
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const message = await authService.forgotPassword(req.body.email);
    return res.status(200).json({
      code: 200,
      success: true,
      message: "Password reset email sent successfully",
      data: message,
    });
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const message = await authService.resetPassword(req.body);
    return res.status(200).json({
      code: 200,
      success: true,
      message: "Password reset successfully",
      data: message,
    });
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};

const adminRegister = async (req, res) => {
  try {
    const response = await authService.adminRegister(req.body);
    return res.status(201).json(response);
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};

const adminLogin = async (req, res) => {
  try {
    const response = await authService.adminLogin(req.body);
    const isProd = config.env === "production";
    res.cookie("accessToken", response.token, {
      httpOnly: true,
      // In dev: DO NOT set domain. In prod: set your parent domain for subdomains.
      domain: isProd ? ".tradingbacktesting.com" : undefined,
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      // Cookie site policy:
      // - If using same-origin dev (Next proxy to API): Lax is fine over HTTP
      // - If cross-site (different ports) OR you want cross-subdomain in prod: use None + Secure
      sameSite: isProd ? "none" : "lax",
      secure: isProd, // must be true when sameSite === 'none'
    });
    return res.status(200).json({
      code: 200,
      success: true,
      message: "Login successful",
      data: response.data,
    });
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};

const verifyUserJWT = async (req, res) => {
  try {
    const user = req?.user;

    if (!user) {
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
        id: user?.id,
        firstName: user?.firstName,
        lastName: user?.lastName,
        email: user?.email,
        role: user?.role,
        plan: user?.plan,
        avatar_url: user?.avatar_url,
        activeTradeAccountId: user?.activeTradeAccountId,
        blocked: user?.blocked,
      },
    });
  } catch (error) {
    console.error("JWT Verification Error:", error);
    return res.status(error?.statusCode || 500).json({
      code: error?.statusCode || 500,
      success: false,
      message: error?.message || "Internal server error during verification",
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
};
