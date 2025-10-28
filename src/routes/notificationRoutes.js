import express from "express";
import {notifcationController} from "../controllers/notificationController.js";
import auth from "../middlewares/auth.js";

const router = express.Router();
router.post("/create", notifcationController.createNotification)
router.get("/get",auth(["admin","user"]), notifcationController.getNotificationsById);
router.delete("/delete/:id",auth(["admin","user"]), notifcationController.deleteNotificationById);
router.delete("/delete-all", auth(["admin","user"]), notifcationController.deleteAllNotifications);
router.patch("/read/:id", auth(["admin","user"]), notifcationController.markAsReadNotification);
router.patch("/read-all/:id", auth(["admin","user"]), notifcationController.markAllAsReadNotification);
router.post("/bulk-create", auth(["admin","user"]), notifcationController.bulkCreateNotifications);
router.delete("/bulk-delete", auth(["admin","user"]), notifcationController.bulkDeleteNotifications);

export default router;
