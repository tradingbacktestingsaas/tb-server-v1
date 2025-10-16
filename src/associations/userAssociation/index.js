// src/models/associations.js
import User from "../../models/user.model.js";
import TradeAccount from "../../models/trade_account.model.js";
import Notification from "../../models/notification.model.js";
import UserNotification from "../../models/user_notification.model.js";

//User <-> TradeAccount Association
User.hasMany(TradeAccount, {
  foreignKey: "userId",
  as: "tradeAccounts", // alias for eager loading
  onDelete: "CASCADE", // delete TradeAccounts if user deleted
});
TradeAccount.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

//User <-> Notification Association
User.hasMany(Notification, {
  foreignKey: "userId",
  as: "notifications",
  onDelete: "CASCADE",
});
Notification.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

//User <-> UserNotification Association
User.hasMany(UserNotification, {
  foreignKey: "userId",
  as: "userNotifications",
  onDelete: "CASCADE",
});
UserNotification.belongsTo(User, {
  foreignKey: "userId",
  as: "userInfo",
});

//Notification <-> UserNotification Association
Notification.hasMany(UserNotification, {
  foreignKey: "notificationId",
  as: "notificationUsers",
  onDelete: "CASCADE",
});
UserNotification.belongsTo(Notification, {
  foreignKey: "notificationId",
  as: "notificationInfo",
});
