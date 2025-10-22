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
    const strategies = await strategiesService.getStrategies(req.query);
    return res.status(200).json(strategies);
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
    const strategies = await strategiesService.deleteStrategies(req.body);
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

export const strategiesController = {
  createStrategies,
  getStrategies,
  updateStrategies,
  deleteStrategies,
  buyStrategy,
};
