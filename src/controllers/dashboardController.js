import { dashboardService } from "../services/dashboardService.js";

const getDashboard = async (req, res) => {
  try {
    const response = await dashboardService.getDashboard(req.query);

    return res.status(response.code).json(response);
  } catch (error) {
    return res.status(error?.statusCode || 500).json({
      success: false,
      code: error?.statusCode || 500,
      message: error.message || "dashboard-fetch-failed",
      data: null,
    });
  }
};

export const dashboardController = { getDashboard };
