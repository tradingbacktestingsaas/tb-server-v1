import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const PurchasedStrategies = sequelize.define(
  "purchased_strategies",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    strategyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "purchased_strategies",
    timestamps: true, // Sequelize handles createdAt & updatedAt
    createdAt: "created_at",
    updatedAt: "updated_at",
    paranoid: false, // if you want soft delete behavior, set this to true
  }
);

export default PurchasedStrategies;
