import { DataTypes } from "sequelize";
import { sequelize } from '../config/db.js';

const BillingCustomer = sequelize.define(
  "billing_customers",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "userld", // matches your table column name
    },
    stripeCustomerId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "stripe_customer_id",
    },
  },
  {
    tableName: "billing_customers",
    timestamps: true, // maps created_at, updated_at
    createdAt: "created_at",
    updatedAt: "updated_at",
    paranoid: true, // adds deleted_at for soft deletes
    deletedAt: "deleted_at",
  }
);

export default BillingCustomer;
