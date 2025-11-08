import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const User = sequelize.define(
  "user",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    token: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "user",
    },
    blocked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    activeTradeAccountId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    avatar_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    avatar_key: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    plan: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    passwordResetVersion: {
      type: DataTypes.BIGINT, // int8
      defaultValue: 0,
    },
  },
  {
    tableName: "user",
    timestamps: true, // enables createdAt & updatedAt
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  }
);

export default User;
