// src/models/associations.js
import User from "../../models/user.model.js";
import TradeAccount from "../../models/trade_account.model.js";
import Notification from "../../models/notification.model.js";
import UserNotification from "../../models/user_notification.model.js";
import UserSubscription from "../../models/user_subscription.model.js";
import Plan from "../../models/plan.model.js";
import PurchasedStrategies from "../../models/purchased_strategies.model.js";
import Strategy from "../../models/strategies.model.js";
import BillingCustomer from "../../models/billing_customer.model.js";

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

User.hasOne(UserSubscription, {
  foreignKey: "userId",
  as: "subscriptions", // alias for eager loading
  onDelete: "CASCADE", // delete TradeAccounts if user deleted
});

UserSubscription.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

Plan.hasMany(UserSubscription, {
  foreignKey: "planid",
  as: "subscriptions", // alias for eager loading
  onDelete: "CASCADE", // delete TradeAccounts if user deleted
});

UserSubscription.belongsTo(Plan, {
  foreignKey: "planid",
  as: "plan",
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

//User <-> purchasedStrategies Association
User.hasMany(PurchasedStrategies, {
  foreignKey: "userId",
  as: "purchasedStrategies",
  onDelete: "CASCADE",
});
PurchasedStrategies.belongsTo(User, {
  foreignKey: "userId",
  as: "userInfo",
});

//Strategy <-> purchasedStrategies Association
Strategy.hasMany(PurchasedStrategies, {
  foreignKey: "strategyId",
  as: "purchasedStrategies",
  onDelete: "CASCADE",
});
PurchasedStrategies.belongsTo(Strategy, {
  foreignKey: "strategyId",
  as: "strategiesInfo",
});

//Billing_customer <-> Users Association
User.hasMany(BillingCustomer, {
  foreignKey: "userId",
  as: "billedUsers",
  onDelete: "CASCADE",
});
BillingCustomer.belongsTo(User, {
  foreignKey: "userId",
  as: "userInfo",
});
