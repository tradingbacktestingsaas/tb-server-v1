import { tradeService } from "../services/tradeService.js";

const createTrade = async (req, res) => {
  try {
    const trade = await tradeService.createTrade(req.body);
    return res.status(201).json(trade);
  } catch (error) {
    return res.status(error.code || 500).json({
      code: error.code || 500,
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

const getTrades = async (req, res) => {
  try {
    const trade = await tradeService.getTrades(req.query);
    return res.status(200).json(trade);
  } catch (error) {
    return res.status(error.code || 500).json({
      code: error.code || 500,
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

const updateTrade = async (req, res) => {
  try {
    const trade = await tradeService.updateTrade(req.body);
    return res.status(200).json(trade);
  } catch (error) {
    return res.status(error.code || 500).json({
      code: error.code || 500,
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

const deleteTrade = async (req, res) => {
  try {
    const trade = await tradeService.deleteTrade(req.params.id);
    return res.status(200).json(trade);
  } catch (error) {
    return res.status(error.code || 500).json({
      code: error.code || 500,
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

const bulkDeleteTrade = async (req, res) => {
  try {
    const trade = await tradeService.bulkDeleteTrade(req.body);
    return res.status(200).json(trade);
  } catch (error) {
    return res.status(error.code || 500).json({
      code: error.code || 500,
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

const bulkCreateTrade = async (req, res) => {
  try {
    const trade = await tradeService.bulkCreateTrade(req.body);
    return res.status(200).json(trade);
  } catch (error) {
    return res.status(error.code || 500).json({
      code: error.code || 500,
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

const getTradeJournal = async (req, res) => {
  try {
    const result = await tradeService.getTradeJournal(req.query);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(error.code || 500).json({
      code: error.code || 500,
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

export const tradeController = {
  createTrade,
  getTrades,
  getTradeJournal,
  updateTrade,
  deleteTrade,
  bulkDeleteTrade,
  bulkCreateTrade,
};
