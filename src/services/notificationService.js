import { Op } from "sequelize";
import Notification from "../models/notification.model.js";
import { emitEvent } from "../websocket/emitter.js";
import { getIO } from "../websocket/index.js";
import { getAllUserIds } from "./usersService.js";
import UserNotification from "../models/user_notification.model.js";

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

export async function getUserNotificationsById(options = {}) {
  try {
    const { limit = 10, offset = 0, userId, type } = options;

    if (!userId) {
      throw new Error("userId is required to fetch notifications");
    }

    // Build query filters
    const notificationWhere = {};
    if (type) {
      notificationWhere.type = type;
    }

    // Query UserNotification table and join Notification table
    const { count, rows } = await UserNotification.findAndCountAll({
      where: { userId },
      include: [
        {
          model: Notification,
          as: "notificationInfo", // ✅ must match your association alias
          attributes: ["id", "title", "message", "type", "created_at"],
          where: notificationWhere,
        },
      ],
      attributes: ["id", "is_read", "viewed_at", "created_at", "updated_at"],
      limit,
      offset,
      order: [["created_at", "DESC"]],
    });

    // Format response for cleaner output
    const formatted = rows.map((row) => ({
      id: row.notificationInfo.id,
      title: row.notificationInfo.title,
      message: row.notificationInfo.message,
      type: row.notificationInfo.type,
      is_read: row.is_read,
      created_at: row.notificationInfo.created_at,
    }));

    return {
      success: true,
      message: "Notifications fetched successfully",
      totalCount: count,
      data: formatted,
    };
  } catch (error) {
    console.error("❌ Error in getNotificationsById:", error);
    throw new Error(`Failed to fetch notifications: ${error.message}`);
  }
}

export async function createNotification(notificationDetail) {
  try {
    const notification = await Notification.create(notificationDetail);
    if (!notification) throw new Error("notification not created");

    const io = getIO();

    if (["system", "promo"].includes(notification.type)) {
      await sendBroadcastNotification(io, {
        id: notification.id,
        title: notification.title,
        type: notification.type,
        message: notification.message,
      });
    } else if (["info", "alert", "reminder"].includes(notification.type)) {
      await sendUserNotification(io, notificationDetail?.userId, {
        id: notification.id,
        title: notification.title,
        type: notification.type,
        message: notification.message,
      });
    }

    return {
      message: "Notification created successfully",
      data: notification,
      success: true,
    };
  } catch (error) {
    console.error("Error in createNotification service:", error);
    throw new Error(`Failed to create notification: ${error.message}`);
  }
}

export async function sendUserNotification(io, userId, notification) {
  // Step 1: Create user-specific record
  const userNotif = await UserNotification.create({
    userId,
    notificationId: notification?.id,
  });

  // Step 2: Emit to that user's socket
  emitEvent(io, `user:${userId}`, {
    title: notification.title,
    type: notification.type,
    message: notification.message,
    isRead: userNotif.isRead,
  });

  return userNotif;
}

export async function sendBroadcastNotification(io, notification) {
  // Step 1: Emit to broadcast channel (real-time)
  emitEvent(io, "broadcast", notification);

  // Step 2: Fetch all user IDs (from your User model)
  const allUserIds = await getAllUserIds();
  // Step 3: Batch insert for scalability
  const batchSize = 1000;
  let index = 0;

  console.log("allUserIds:", allUserIds);
  const processBatch = async () => {
    const batch = allUserIds.slice(index, index + batchSize);
    if (batch.length === 0) return;

    const userNotifs = batch.map((userId) => ({
      userId,
      notificationId: notification.id, // Sequelize uses `id`, not `_id`
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    console.log("userNotifs:", userNotifs);

    // ✅ Sequelize equivalent of insertMany
    await UserNotification.bulkCreate(userNotifs, { ignoreDuplicates: true });

    index += batchSize;
    setImmediate(processBatch); // Schedule next batch asynchronously
  };

  setImmediate(processBatch);

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

export async function bulkDeleteNotifications(notificationIds = [], userId) {
  try {
    if (!userId) throw new Error("userId is required");
    if (!Array.isArray(notificationIds) || notificationIds.length === 0)
      throw new Error("No notification IDs provided");

    const deletedCount = await UserNotification.destroy({
      where: {
        userId, // only delete this user's notifications
        notificationId: {
          [Op.in]: notificationIds,
        },
      },
    });

    if (deletedCount === 0) {
      return {
        success: false,
        message: "No notifications found or already deleted",
        data: [],
      };
    }

    return {
      success: true,
      message: "Notifications deleted successfully",
      data: { deletedCount },
    };
  } catch (error) {
    console.error("❌ Error in bulkDeleteNotifications:", error);
    throw new Error(`Failed to delete notifications: ${error.message}`);
  }
}

export async function deleteAllNotifications(userId) {
  const deletedCount = await UserNotification.destroy({
    where: { userId },
  });
  if (!deletedCount)
    return {
      message: "Failed to delete all",
      success: false,
      code: 400,
    };

  return {
    message: "Successfully deleted notifications",
    success: true,
    code: 200,
  };
}

const deleteNotificationById = async (notificationId) => {
  try {
    const notification = await UserNotification.findByPk(notificationId);
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
    const notification = await UserNotification.findByPk(notifcationId);
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

const markAllAsReadNotification = async (userId) => {
  try {
    const notifications = await UserNotification.findAll({
      where: { userId: userId },
    });

    for (const notification of notifications) {
      notification.is_read = true;
      notification.viewed_at = new Date();
      await notification.save();
    }

    return {
      message: "notification updated successfully",
      data: notifications,
      success: true,
    };
  } catch (error) {
    console.error("Error in markAllAsReadNotification service:", error);
    throw new Error(`Failed to update notification: ${error}`);
  }
};

export const notificationService = {
  bulkCreateNotifications,
  bulkDeleteNotifications,
  createNotification,
  getUserNotificationsById,
  deleteAllNotifications,
  getNotificationsById,
  deleteNotificationById,
  markAsReadNotification,
  markAllAsReadNotification,
};
