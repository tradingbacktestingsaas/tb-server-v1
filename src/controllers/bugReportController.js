import { bugReportService } from "../services/bugReportService.js";

const createBugReport = async (req, res) => {
  try {
    const result = await bugReportService.createBugReport(req.body);
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

const getBugReports = async (req, res) => {
  try {
    const result = await bugReportService.getBugReports(req.query);
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

const getBugReportById = async (req, res) => {
  try {
    const result = await bugReportService.getBugReportById(req.params.id);
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

const updateBugReport = async (req, res) => {
  try {
    const result = await bugReportService.updateBugReport(
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

const deleteBugReport = async (req, res) => {
  try {
    const result = await bugReportService.deleteBugReport(req.params.id);
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

const getUserBugReports = async (req, res) => {
  try {
    const result = await bugReportService.getUserBugReports(
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

export const bugReportController = {
  createBugReport,
  getBugReports,
  getBugReportById,
  updateBugReport,
  deleteBugReport,
  getUserBugReports,
};
