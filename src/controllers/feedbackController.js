import { feedbackService } from "../services/feedbackService.js";

const createFeedback = async (req, res) => {
  try {
    const result = await feedbackService.createFeedback(req.body);
    return res.status(201).json(result);
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};

const getFeedbacks = async (req, res) => {
  try {
    const result = await feedbackService.getFeedbacks(req.query);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};

const getFeedbackById = async (req, res) => {
  try {
    const result = await feedbackService.getFeedbackById(req.params.id);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};

const updateFeedback = async (req, res) => {
  try {
    const result = await feedbackService.updateFeedback(
      req.params.id,
      req.body,
    );
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};

const deleteFeedback = async (req, res) => {
  try {
    const result = await feedbackService.deleteFeedback(req.params.id);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};

const getUserFeedbacks = async (req, res) => {
  try {
    const result = await feedbackService.getUserFeedbacks(
      req.params.userId,
      req.query,
    );
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};

export const feedbackController = {
  createFeedback,
  getFeedbacks,
  getFeedbackById,
  updateFeedback,
  deleteFeedback,
  getUserFeedbacks,
};
