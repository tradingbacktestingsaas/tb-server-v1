import { usersService } from "../services/usersService.js";

const getUsers = async (req, res) => {
  try {
    const user = await usersService.getUsers(req.query);
    return res.status(201).json(user);
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};

const uploadAvatar = async (req, res) => {
  try {
    const user = await usersService.uploadAvatar(req.params.id, req);
    return res.status(201).json(user);
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};

const getUserById = async (req, res) => {
  try {
    const user = await usersService.getUserById(req.params.id);
    return res.status(201).json(user);
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};

const bulkCreateUsers = async (req, res) => {
  try {
    const user = await usersService.bulkCreateUsers(req.body);
    return res.status(201).json(user);
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};

const bulkDeleteUsers = async (req, res) => {
  try {
    const user = await usersService.bulkDeleteUsers(req.body);
    return res.status(201).json(user);
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};

const deleteUser = async (req, res) => {
  try {
    const user = await usersService.deleteUser(req.params.id);
    return res.status(201).json(user);
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};

const updateUser = async (req, res) => {
  try {
    const response = await usersService.updateUser(req.params.id, req.body);
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

    return res.status(201).json(response);
  } catch (error) {
    return res.status(400).json({
      code: error,
      success: false,
      message: error.message,
      data: null,
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const user = await usersService.changePassword(
      req.params.id,
      req.body.password
    );
    return res.status(201).json(user);
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};

export const usersController = {
  getUsers,
  getUserById,
  bulkCreateUsers,
  bulkDeleteUsers,
  deleteUser,
  updateUser,
  changePassword,
  uploadAvatar,
};
