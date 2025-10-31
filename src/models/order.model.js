import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const Order = sequelize.define(
  "orders",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "userld",
    },
    planId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "planld",
    },
    planCode: {
      type: DataTypes.STRING(16),
      allowNull: true,
      field: "plan_code",
    },
    amountSubtotalCents: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: "amount_subtotal_cents",
    },
    amountDiscountCents: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
      field: "amount_discount_cents",
    },
    amountTotalCents: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: "amount_total_cents",
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: "USD",
    },
    provider: {
      type: DataTypes.STRING(16),
      allowNull: true,
    },
    providerCheckoutSessionId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "provider_checkout_session_id",
    },
    status: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: "pending", // can be "pending", "paid", "failed", etc.
    },
    couponId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "couponld",
    },
    invoiceId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "invoice_id",
    },
    hostedInvoiceUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "hosted_invoice_url",
    },
    provider_sub_id: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "provider_sub_id",
    },
    cycle: {
      type: DataTypes.STRING(32),
      allowNull: true,
      field: "cycle",
    },
    strategyId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "strategyid",
    },
  },
  {
    tableName: "order",
    timestamps: true, // adds createdAt and updatedAt
    createdAt: "created_at",
    updatedAt: "updated_at",
    paranoid: true, // adds deletedAt
    deletedAt: "deleted_at",
  }
);

export default Order;
