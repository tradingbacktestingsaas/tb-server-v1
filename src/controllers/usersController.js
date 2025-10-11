import { usersService } from '../services/usersService.js';

const getUsers = async (req, res) => {
  try {
    const user = await usersService.getUsers(req.query);
    return res.status(201).json(user);
  } catch (error) {
    return res.status(400).json(
      {
        code: 400,
        success: false,
        message: error.message,
        data: null
      }
    );
  }
};

export const usersController = {
    getUsers,
  }
