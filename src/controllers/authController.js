import { authService } from "../services/authService.js";
// const { successResponse, errorResponse } = require('../utils/response.js');

const register = async (req, res) => {
  try {
    const user = await authService.register(req.body);
    return res.status(201).json({
      code: 201,
      success: true,
      message: "User registered successfully",
      data: user,
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

const login = async (req, res) => {
  try {
    const response = await authService.login(req.body);
    const isProd = process.env.NODE_ENV === "production";
    const domain = isProd ? "tradingbacktesting.com" : "localhost";
    res.cookie("accessToken", response.token, {
      domain: domain,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7,
      path: "/",
    });

    return res.status(200).json({
      code: 200,
      success: true,
      message: "Login successful",
      data: data,
      redirectTo: response.redirectTo,
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
    const isProd = process.env.NODE_ENV === "production";
    const domain = isProd ? "tradingbacktesting.com" : "localhost";
    res.cookie("accessToken", response.token, {
      domain: domain,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7,
      path: "/",
    });
    return res.status(200).json({
      code: 200,
      success: true,
      message: "Login successful",
      data: data,
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

export const authController = {
  register,
  login,
  forgotPassword,
  resetPassword,
  adminRegister,
  adminLogin,
};
