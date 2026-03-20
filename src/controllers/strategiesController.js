import { strategiesService } from "../services/strategiesService.js";

const createStrategies = async (req, res) => {
  try {
    const strategies = await strategiesService.createStrategies(req.body);
    return res.status(201).json(strategies);
  } catch (error) {
    return res.status(error.code || 500).json({
      code: error.code || 500,
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

const getStrategies = async (req, res) => {
  try {
    const strategies = await strategiesService.getStrategies(
      req.query,
      req.query.userId,
    );
    return res.status(200).json(strategies);
  } catch (error) {
    return res.status(error.code || 500).json({
      code: error.code || 500,
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

const getStrategyById = async (req, res) => {
  try {
    const strategy = await strategiesService.getStrategyById(req.params.id);
    return res.status(strategy.code || 200).json(strategy);
  } catch (error) {
    return res.status(error.code || 500).json({
      code: error.code || 500,
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

const getPurchasedStrategies = async (req, res) => {
  try {
    // Extract auth user ID from req.user (set by auth middleware)
    const authUserId = req.query?.userId || req.user?.sub;
    const strategies = await strategiesService.getPurchasedStrategies(
      req.query,
      authUserId,
    );
    return res.status(strategies.code).json(strategies);
  } catch (error) {
    return res.status(error.code || 500).json({
      code: error.code || 500,
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

const updateStrategies = async (req, res) => {
  try {
    const strategies = await strategiesService.updateStrategies(req.body);
    return res.status(200).json(strategies);
  } catch (error) {
    return res.status(error.code || 500).json({
      code: error.code || 500,
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

const deleteStrategies = async (req, res) => {
  try {
    const strategies = await strategiesService.deleteStrategies(req.params);
    return res.status(200).json(strategies);
  } catch (error) {
    return res.status(error.code || 500).json({
      code: error.code || 500,
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

const buyStrategy = async (req, res) => {
  try {
    const strategies = await strategiesService.buyStrategy(req.body);
    return res.status(200).json(strategies);
  } catch (error) {
    return res.status(error.code || 500).json({
      code: error.code || 500,
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

const bulkCreate = async (req, res) => {
  try {
    const strategies = await strategiesService.bulkCreateStrategy(req.body);
    return res.status(200).json(strategies);
  } catch (error) {
    return res.status(error.code || 500).json({
      code: error.code || 500,
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

export const strategiesController = {
  createStrategies,
  getStrategies,
  getStrategyById,
  getPurchasedStrategies,
  updateStrategies,
  deleteStrategies,
  buyStrategy,
  bulkCreate,
};
