import { DataTypes } from "sequelize";
import { sequelize } from '../config/db.js';

const Trade = sequelize.define(
  "trades",
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
    ticket: {
      type: DataTypes.BIGINT, // int8(64,0)
      allowNull: false,
    },
    accountNumber: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    symbol: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING, // e.g., "buy" / "sell"
      allowNull: false,
    },
    lots: {
      type: DataTypes.DOUBLE, // float8(53)
      allowNull: false,
    },
    openPrice: {
      type: DataTypes.DOUBLE,
      allowNull: false,
    },
    closePrice: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    profit: {
      type: DataTypes.DOUBLE,
      allowNull: true,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.STRING, // e.g., "open", "closed"
      allowNull: false,
      defaultValue: "open",
    },
    slippage: {
      type: DataTypes.DOUBLE,
      allowNull: true,
      defaultValue: 0,
    },
    accountId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    openDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    closeDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "trades",
    timestamps: true, // createdAt & updatedAt handled automatically
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  }
);

export default Trade;
