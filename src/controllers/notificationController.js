import { notificationService } from "../services/notificationService.js";

const getNotificationsById = async (req, res) => {
  try {
    const notification = await notificationService.getNotificationsById(
      req.query
    );
    return res.status(201).json(notification);
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};

const createNotification = async (req, res) => {
  try {
    const notification = await notificationService.createNotification(req.body);
    return res.status(201).json(notification);
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};

const bulkCreateNotifications = async (req, res) => {
  try {
    const notification = await notificationService.bulkCreateNotifications(
      req.body
    );
    return res.status(201).json(notification);
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};

const bulkDeleteNotifications = async (req, res) => {
  try {
    const notification = await notificationService.bulkDeleteNotifications(
      req.body
    );
    return res.status(201).json(notification);
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};

const deleteNotificationById = async (req, res) => {
  try {
    const notification = await notificationService.deleteNotificationById(
      req.params.id
    );
    return res.status(201).json(notification);
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};

const markAsReadNotification = async (req, res) => {
  try {
    const notification = await notificationService.markAsReadNotification(
      req.params.id
    );
    return res.status(201).json(notification);
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};

export const notifcationController = {
  createNotification,
  getNotificationsById,
  deleteNotificationById,
  bulkCreateNotifications,
  bulkDeleteNotifications,
  markAsReadNotification,
};
