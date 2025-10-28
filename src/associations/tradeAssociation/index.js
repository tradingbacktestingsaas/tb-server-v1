// src/models/associations.js

import Trade from "../../models/trade.model.js";
import TradeAccount from "../../models/trade_account.model.js";

//User <-> TradeAccount Association
TradeAccount.hasMany(Trade, {
  foreignKey: "accountId",
  as: "trades", // alias for eager loading
  onDelete: "CASCADE", // delete TradeAccounts if user deleted
});
Trade.belongsTo(TradeAccount, {
  foreignKey: "accountId",
  as: "tradeAccounts",
});

