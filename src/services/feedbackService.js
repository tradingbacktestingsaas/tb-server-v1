import Feedback from "../models/feedback.model.js";
import User from "../models/user.model.js";
import { Op } from "sequelize";

export async function createFeedback(data) {
  try {
    const feedback = await Feedback.create(data);

    await User.update(
      { is_feedback_completed: true },
      { where: { id: feedback.userId } },
    );

    return {
      code: 201,
      success: true,
      message: "Feedback created successfully",
      data: feedback,
    };
  } catch (error) {
    throw new Error(`Failed to create feedback: ${error.message}`);
  }
}

export async function getFeedbacks(options = {}) {
  try {
    const { userId, status, limit = 10, offset = 0 } = options;

    const where = {};

    if (userId) {
      where.userId = userId;
    }

    if (status) {
      where.status = status;
    }

    const { count, rows } = await Feedback.findAndCountAll({
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
      message: "Feedbacks retrieved successfully",
      data: {
        feedbacks: rows,
        totalCount: count,
        limit,
        offset,
      },
    };
  } catch (error) {
    throw new Error(`Failed to fetch feedbacks: ${error.message}`);
  }
}

export async function getFeedbackById(id) {
  try {
    const feedback = await Feedback.findByPk(id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "firstName", "lastName", "email"],
        },
      ],
    });

    if (!feedback) {
      throw new Error("Feedback not found");
    }

    return {
      code: 200,
      success: true,
      message: "Feedback retrieved successfully",
      data: feedback,
    };
  } catch (error) {
    throw new Error(`Failed to fetch feedback: ${error.message}`);
  }
}

export async function updateFeedback(id, data) {
  try {
    const feedback = await Feedback.findByPk(id);

    if (!feedback) {
      throw new Error("Feedback not found");
    }

    await feedback.update(data);

    return {
      code: 200,
      success: true,
      message: "Feedback updated successfully",
      data: feedback,
    };
  } catch (error) {
    throw new Error(`Failed to update feedback: ${error.message}`);
  }
}

export async function deleteFeedback(id) {
  try {
    const feedback = await Feedback.findByPk(id);

    if (!feedback) {
      throw new Error("Feedback not found");
    }

    await feedback.destroy();

    return {
      code: 200,
      success: true,
      message: "Feedback deleted successfully",
      data: null,
    };
  } catch (error) {
    throw new Error(`Failed to delete feedback: ${error.message}`);
  }
}

export async function getUserFeedbacks(userId, options = {}) {
  try {
    const { status, limit = 10, offset = 0 } = options;

    const where = { userId };

    if (status) {
      where.status = status;
    }

    const { count, rows } = await Feedback.findAndCountAll({
      where,
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    return {
      code: 200,
      success: true,
      message: "User feedbacks retrieved successfully",
      data: {
        feedbacks: rows,
        totalCount: count,
        limit,
        offset,
      },
    };
  } catch (error) {
    throw new Error(`Failed to fetch user feedbacks: ${error.message}`);
  }
}

export const feedbackService = {
  createFeedback,
  getFeedbacks,
  getFeedbackById,
  updateFeedback,
  deleteFeedback,
  getUserFeedbacks,
};
