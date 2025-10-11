import { DataTypes } from "sequelize";
import { sequelize } from '../config/db.js';

const TradeAccount = sequelize.define(
  "trade_account",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    uuid: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      unique: true,
    },
    accountid: {
      type: DataTypes.STRING, // trading account ID (e.g., MT4/MT5 account number)
      allowNull: false,
    },
    investor_password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    broker_server: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    TradesyncId: {
      type: DataTypes.STRING,
      allowNull: true, // ID used for syncing with external trading service
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    token: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING, // e.g., "demo" or "real"
      allowNull: false,
      defaultValue: "demo",
    },
  },
  {
    tableName: "trade_accounts",
    timestamps: true, // handles createdAt & updatedAt automatically
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  }
);

export default TradeAccount;
