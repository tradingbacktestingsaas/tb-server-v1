import { DataTypes } from "sequelize";
import { sequelize } from '../config/db.js';

const UserSubscription = sequelize.define(
  "user_subscription",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    planid: {
      type: DataTypes.UUID,
      allowNull: true, // assuming a foreign key to a plans table
    },
    plan_code: {
      type: DataTypes.STRING(16),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: "active", // e.g. active, expired, canceled
    },
    start_date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    current_period_end: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    provider: {
      type: DataTypes.STRING(16), // e.g. "stripe", "paypal"
      allowNull: false,
    },
    provider_sub_id: {
      type: DataTypes.STRING,
      allowNull: true, // subscription ID from payment provider
    },
    auto_renew: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  },
  {
    tableName: "user_subscription",
    timestamps: true, // manages createdAt & updatedAt automatically
    createdAt: "created_at",
    updatedAt: "updated_at",
    paranoid: true, // enables soft delete using deleted_at
    deletedAt: "deleted_at",
  }
);

export default UserSubscription;
