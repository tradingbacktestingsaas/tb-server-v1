import { analyticsService } from "../services/analyticsService.js";

const dashboardAnalytics = async (req, res) => {
  try {
    const stats = await analyticsService.getStats(req.params.id);

    return res.status(201).json({ analytics: stats.data });
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};

const leaderBoard = async (req, res) => {
  try {
    const stats = await analyticsService.podium();

    return res.status(201).json({ analytics: stats.data });
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};

export const analyticsController = {
  dashboardAnalytics,
  leaderBoard,
};
