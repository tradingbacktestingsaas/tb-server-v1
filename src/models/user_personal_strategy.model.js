import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const UserPersonalStrategy = sequelize.define(
  "user_personal_strategies",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: true, // e.g., FREE, STANDARD, ELITE
    },
    type: {
      type: DataTypes.STRING, // example enum values "scalping", "swing", "day", "longterm"
      allowNull: false,
    },
    isPremium: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    tableName: "user_personal_strategies",
    timestamps: true, // adds createdAt and updatedAt
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export default UserPersonalStrategy;
