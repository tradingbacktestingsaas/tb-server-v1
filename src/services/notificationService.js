import { Op } from "sequelize";
import Notification from "../models/notification.model.js";
import { emitEvent } from "../websocket/emitter.js";

export async function getNotificationsById(options = {}) {
  try {
    const { limit = 10, offset = 0, userId, type } = options;
    let where = {};

    if (type) {
      where.type = type;
    }
    if (userId) {
      where.userId = userId;
    }

    const { count, rows } = await Notification.findAndCountAll({
      attributes: [
        "id",
        "title",
        "message",
        "is_read",
        "viewed_at",
        "created_at",
      ],
      where,
      limit,
      offset,
      order: [["created_at", "DESC"]],
    });

    return {
      data: rows,
      totalCount: count,
      success: true,
      message: "Notifications fetched successfully",
    };
  } catch (error) {
    console.error("Error in getNotifications service:", error);
    throw new Error(`Failed to fetch notifications: ${error.message || error}`);
  }
}

export async function createNotification(notificationDetail) {
  try {
    const notification = await Notification.create(notificationDetail, {
      validate: true,
      returning: true,
    });

    if (!notification) {
      throw new Error("notification not created");
    }

    if (notification.type === "system" || notification.type === "promo")
      sendBroadcastNotification(notificationDetail, {
        title: notificationDetail.title,
        type: notificationDetail.type,
        message: notificationDetail.message,
      });
    if (
      notification.type === "info" ||
      notification.type === "alert" ||
      notification.type === "reminder"
    )
      sendUserNotification(notificationDetail.userId, notificationDetail, {
        title: notificationDetail.title,
        type: notificationDetail.type,
        message: notificationDetail.message,
      });

    return {
      message: "notification created successfully",
      data: notification,
      success: true,
    };
  } catch (error) {
    console.error("Error in createNotification service:", error);
    throw new Error(`Failed to create notification: ${error}`);
  }
}

export async function sendUserNotification(
  io,
  userId,
  { title, type, message }
) {
  const notification = await Notification.create({
    userId,
    title,
    type,
    message,
  });
  emitEvent(io, `user:${userId}`, notification);
  return notification;
}

export async function sendBroadcastNotification(io, { title, type, message }) {
  const notification = await Notification.create({
    userId: null,
    title,
    type,
    message,
  });
  emitEvent(io, "broadcast", notification);
  return notification;
}

export async function bulkCreateNotifications(notificationDetail) {
  try {
    const notification = await Notification.bulkCreate(notificationDetail, {
      validate: true,
      returning: true,
      ignoreDuplicates: true,
    });

    if (!notification) {
      throw new Error("notification not created");
    }

    return {
      message: "notification created successfully",
      data: notification,
      success: true,
    };
  } catch (error) {
    console.error("Error in createBulkNotification service:", error);
    throw new Error(`Failed to create notification: ${error}`);
  }
}

export async function bulkDeleteNotifications(notificationId) {
  try {
    const notification = await Notification.destroy({
      where: {
        id: {
          [Op.in]: notificationId,
        },
      },
    });

    if (!notification) {
      throw new Error("notification not found");
    }

    return {
      message: "notification deleted successfully",
      data: notification,
      success: true,
    };
  } catch (error) {
    console.error("Error in deleteBulkNotification service:", error);
    throw new Error(`Failed to delete notification: ${error}`);
  }
}

const deleteNotificationById = async (notificationId) => {
  try {
    const notification = await Notification.findByPk(notificationId);
    if (!notification) {
      throw new Error("notification not found");
    }
    await notification.destroy();
    return {
      message: "notification deleted successfully",
      data: notification,
      success: true,
    };
  } catch (error) {
    console.error("Error in deleteNotification service:", error);
    throw new Error(`Failed to delete notification: ${error}`);
  }
};

const markAsReadNotification = async (notifcationId) => {
  try {
    const notification = await Notification.findByPk(notifcationId);
    if (!notification) {
      throw new Error("notification not found");
    }

    notification.is_read = true;
    notification.viewed_at = new Date();

    const updatedNotification = await notification.save();

    if (!updatedNotification) {
      throw new Error("notification not updated");
    }

    return {
      message: "notification updated successfully",
      data: updatedNotification,
      success: true,
    };
  } catch (error) {
    console.error("Error in markAsReadNotification service:", error);
    throw new Error(`Failed to update notification: ${error}`);
  }
};

export const notificationService = {
  bulkCreateNotifications,
  bulkDeleteNotifications,
  createNotification,
  getNotificationsById,
  deleteNotificationById,
  markAsReadNotification,
};
