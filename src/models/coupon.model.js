import { DataTypes } from "sequelize";
import { sequelize } from '../config/db.js';

const Coupon = sequelize.define(
  "coupons",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    type: {
      type: DataTypes.STRING(16), // e.g. 'percentage', 'fixed'
      allowNull: false,
    },
    value: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    appliesTo: {
      type: DataTypes.STRING(16), // e.g. 'plan', 'user', etc.
      allowNull: true,
      field: "applies_to",
    },
    class: {
      type: DataTypes.STRING(16), // e.g. 'public', 'private'
      allowNull: true,
    },
    maxRedemptions: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: "max_redemptions",
    },
    perUserLimit: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: "per_user_limit",
    },
    startAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "start_at",
    },
    endAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "end_at",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "is_active",
    },
    metadataJson: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: "metadata_json",
    },
  },
  {
    tableName: "coupons",
    timestamps: true, // maps created_at, updated_at
    createdAt: "created_at",
    updatedAt: "updated_at",
    paranoid: true, // enables soft delete
    deletedAt: "deleted_at",
  }
);

export default Coupon;
