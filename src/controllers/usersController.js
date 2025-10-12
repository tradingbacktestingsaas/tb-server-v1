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
    const user = await usersService.updateUser(req.params.id, req.body);
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
};
