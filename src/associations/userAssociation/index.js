// src/models/associations.js
import User from "../../models/user.model.js";
import TradeAccount from "../../models/trade_account.model.js";
// import Notification from "../../models/notification.model.js";

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
// User.hasMany(Notification, {
//   foreignKey: "userId",
//   as: "notifications",
//   onDelete: "CASCADE",
// });
// Notification.belongsTo(User, {
//   foreignKey: "userId",
//   as: "user",
// });
