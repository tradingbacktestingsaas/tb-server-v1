// src/models/associations.js
import User from "../../models/user.model.js";
import Order from "../../models/order.model.js";
import Plan from "../../models/plan.model.js";
import Strategy from "../../models/strategies.model.js";

//
// 🧍 USER ↔️ ORDER
//
User.hasMany(Order, {
  foreignKey: "userId",
  as: "orders", // ✅ user.orders
  onDelete: "CASCADE",
});
Order.belongsTo(User, {
  foreignKey: "userId",
  as: "user", // ✅ order.user
});

//
// 🧾 PLAN ↔️ ORDER
//
Plan.hasMany(Order, {
  foreignKey: "planId",
  as: "orders", // ✅ plan.orders
  onDelete: "CASCADE",
});
Order.belongsTo(Plan, {
  foreignKey: "planId",
  as: "plan", // ✅ order.plan
});

//
// ⚙️ STRATEGY ↔️ ORDER
//
Strategy.hasMany(Order, {
  foreignKey: "strategyId",
  as: "orders", // ✅ strategy.orders
  onDelete: "CASCADE",
});
Order.belongsTo(Strategy, {
  foreignKey: "strategyId",
  as: "strategy", // ✅ order.strategy
});
