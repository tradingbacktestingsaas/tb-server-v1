import BugReport from "../models/bug_report.model.js";
import User from "../models/user.model.js";
import { Op } from "sequelize";

export async function createBugReport(data) {
  try {
    const bugReport = await BugReport.create(data);
    return {
      code: 201,
      success: true,
      message: "Bug Report created successfully",
      data: bugReport,
    };
  } catch (error) {
    throw new Error(`Failed to create bug report: ${error.message}`);
  }
}

export async function getBugReports(options = {}) {
  try {
    const { userId, status, priority, limit = 10, offset = 0 } = options;

    const where = {};

    if (userId) {
      where.userId = userId;
    }

    if (status) {
      where.status = status;
    }

    if (priority) {
      where.priority = priority;
    }

    const { count, rows } = await BugReport.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "firstName", "lastName", "email"],
        },
      ],
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    return {
      code: 200,
      success: true,
      message: "Bug Reports retrieved successfully",
      data: {
        bugReports: rows,
        totalCount: count,
        limit,
        offset,
      },
    };
  } catch (error) {
    throw new Error(`Failed to fetch bug reports: ${error.message}`);
  }
}

export async function getBugReportById(id) {
  try {
    const bugReport = await BugReport.findByPk(id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "firstName", "lastName", "email"],
        },
      ],
    });

    if (!bugReport) {
      throw new Error("Bug Report not found");
    }

    return {
      code: 200,
      success: true,
      message: "Bug Report retrieved successfully",
      data: bugReport,
    };
  } catch (error) {
    throw new Error(`Failed to fetch bug report: ${error.message}`);
  }
}

export async function updateBugReport(id, data) {
  try {
    const bugReport = await BugReport.findByPk(id);

    if (!bugReport) {
      throw new Error("Bug Report not found");
    }

    await bugReport.update(data);

    return {
      code: 200,
      success: true,
      message: "Bug Report updated successfully",
      data: bugReport,
    };
  } catch (error) {
    throw new Error(`Failed to update bug report: ${error.message}`);
  }
}

export async function deleteBugReport(id) {
  try {
    const bugReport = await BugReport.findByPk(id);

    if (!bugReport) {
      throw new Error("Bug Report not found");
    }

    await bugReport.destroy();

    return {
      code: 200,
      success: true,
      message: "Bug Report deleted successfully",
      data: null,
    };
  } catch (error) {
    throw new Error(`Failed to delete bug report: ${error.message}`);
  }
}

export async function getUserBugReports(userId, options = {}) {
  try {
    const { status, priority, limit = 10, offset = 0 } = options;

    const where = { userId };

    if (status) {
      where.status = status;
    }

    if (priority) {
      where.priority = priority;
    }

    const { count, rows } = await BugReport.findAndCountAll({
      where,
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    return {
      code: 200,
      success: true,
      message: "User bug reports retrieved successfully",
      data: {
        bugReports: rows,
        totalCount: count,
        limit,
        offset,
      },
    };
  } catch (error) {
    throw new Error(`Failed to fetch user bug reports: ${error.message}`);
  }
}

export const bugReportService = {
  createBugReport,
  getBugReports,
  getBugReportById,
  updateBugReport,
  deleteBugReport,
  getUserBugReports,
};
