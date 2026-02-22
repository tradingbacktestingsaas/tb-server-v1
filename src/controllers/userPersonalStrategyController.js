import { userPersonalStrategyService } from "../services/userPersonalStrategyService.js";

const createUserPersonalStrategy = async (req, res) => {
  try {
    const strategy =
      await userPersonalStrategyService.createUserPersonalStrategy(req.body);
    return res.status(strategy.code).json(strategy);
  } catch (error) {
    return res.status(error.code || 500).json({
      code: error.code || 500,
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

const getUserPersonalStrategies = async (req, res) => {
  console.log(req.query)
  try {
    const strategies =
      await userPersonalStrategyService.getUserPersonalStrategies(req.query);
    return res.status(strategies.code).json(strategies);
  } catch (error) {
    return res.status(error.code || 500).json({
      code: error.code || 500,
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

const getUserPersonalStrategyById = async (req, res) => {
  try {
    const { id } = req.params;
    const strategy =
      await userPersonalStrategyService.getUserPersonalStrategyById(id);
    return res.status(strategy.code).json(strategy);
  } catch (error) {
    return res.status(error.code || 500).json({
      code: error.code || 500,
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

const updateUserPersonalStrategy = async (req, res) => {
  console.log(req.body);
  
  try {
    const strategy =
      await userPersonalStrategyService.updateUserPersonalStrategy(req.body);
    return res.status(strategy.code).json(strategy);
  } catch (error) {
    return res.status(error.code || 500).json({
      code: error.code || 500,
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

const deleteUserPersonalStrategy = async (req, res) => {
  try {
    const { id } = req.params;
    const result =
      await userPersonalStrategyService.deleteUserPersonalStrategy(id);
    return res.status(result.code).json(result);
  } catch (error) {
    return res.status(error.code || 500).json({
      code: error.code || 500,
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

const getUserStrategiesByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    const strategies =
      await userPersonalStrategyService.getUserStrategiesByUserId(userId);
    return res.status(strategies.code).json(strategies);
  } catch (error) {
    return res.status(error.code || 500).json({
      code: error.code || 500,
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

export const userPersonalStrategyController = {
  createUserPersonalStrategy,
  getUserPersonalStrategies,
  getUserPersonalStrategyById,
  updateUserPersonalStrategy,
  deleteUserPersonalStrategy,
  getUserStrategiesByUserId,
};
