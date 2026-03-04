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
    reset_otp_expiry: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    is_verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    reset_otp: {
      type: DataTypes.STRING(6),
      allowNull: true,
      defaultValue: null,
    },
    otp: {
      type: DataTypes.STRING(10),
      allowNull: true,
      defaultValue: null,
    },
    otp_expiry: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    // ("local", "google", "facebook", "github"),
    auth_provider: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "local",
    },
    is_notifications_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    is_update_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    is_feedback_completed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
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
    onboarding_completed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
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
  },
);

export default User;
