import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const Plan = sequelize.define(
  "plan",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING(32), // plan code: STANDARD, ELITE, FREE
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    price_cents: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    features: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "plans",
    timestamps: true, // Sequelize handles createdAt & updatedAt
    createdAt: "created_at",
    updatedAt: "updated_at",
    paranoid: false, // if you want soft delete behavior, set this to true
  }
);

export default Plan;
