// import { Op, Sequelize } from "sequelize";
// import { encrypt } from "../utils/cryptoUtil.js";
// import Notification from "../models/notification.model.js";

// export async function getNotificationsById(options = {}) {
//   try {
//     const { limit = 10, offset = 0 } = options;

//     const { count, rows } = await Notification.findAndCountAll({
//       attributes: [
//         "id",
//         "title",
//         "message",
//         "is_read",
//         "viewed_at",
//         "createdAt",
//       ],
//       limit,
//       offset,
//       order: [["createdAt", "DESC"]],
//     });

//     return {
//       users: rows,
//       totalCount: count,
//       success: true,
//       message: "Notifications fetched successfully",
//     };
//   } catch (error) {
//     console.error("Error in getNotifications service:", error);
//     throw new Error(`Failed to fetch notifications: ${error.message || error}`);
//   }
// }

// export async function bulkCreateNotifications(notificationDetail) {
//   try {
//     const notification = await Notification.bulkCreate(notificationDetail, {
//       validate: true,
//       returning: true,
//       ignoreDuplicates: true,
//     });

//     if (!notification) {
//       throw new Error("notification not created");
//     }

//     return {
//       message: "notification created successfully",
//       data: notification,
//       success: true,
//     };
//   } catch (error) {
//     console.error("Error in createBulkNotification service:", error);
//     throw new Error(`Failed to create notification: ${error}`);
//   }
// }

// export async function bulkDeleteNotifications(notificationId) {
//   try {
//     const notification = await Notification.destroy({
//       where: {
//         id: {
//           [Op.in]: notificationId,
//         },
//       },
//     });

//     if (!notification) {
//       throw new Error("notification not found");
//     }

//     return {
//       message: "notification deleted successfully",
//       data: notification,
//       success: true,
//     };
//   } catch (error) {
//     console.error("Error in deleteBulkNotification service:", error);
//     throw new Error(`Failed to delete notification: ${error}`);
//   }
// }

// const deleteNotificationById = async (userId) => {
//   try {
//     const notification = await Notification.findByPk(userId);
//     if (!notification) {
//       throw new Error("notification not found");
//     }
//     await user.destroy();
//     return {
//       message: "notification deleted successfully",
//       data: notification,
//       success: true,
//     };
//   } catch (error) {
//     console.error("Error in deleteNotification service:", error);
//     throw new Error(`Failed to delete notification: ${error}`);
//   }
// };

// const markAsReadNotification = async (notifcationId) => {
//   try {
//     const notification = await Notification.findByPk(notifcationId);
//     if (!notification) {
//       throw new Error("notification not found");
//     }

//     const updatedNotification = await Notification.update({
//       is_read: true,
//       viewed_at: new Date(),
//     });
//     if (!updatedNotification) {
//       throw new Error("notification not updated");
//     }

//     return {
//       message: "notification updated successfully",
//       data: user,
//       success: true,
//     };
//   } catch (error) {
//     console.error("Error in markAsReadNotification service:", error);
//     throw new Error(`Failed to update notification: ${error}`);
//   }
// };

// export const notificationService = {
//   bulkCreateNotifications,
//   bulkDeleteNotifications,
//   getNotificationsById,
//   deleteNotificationById,
//   markAsReadNotification,
// };
