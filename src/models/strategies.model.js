import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const Strategy = sequelize.define(
  "strategies",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    content: {
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
    cover_url: {
      type: DataTypes.STRING, // cover image
      allowNull: true,
    },
    cover_id: {
      type: DataTypes.STRING, // cover image
      allowNull: true,
    },
    isPremium: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    hasPrice: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: true,
      defaultValue: "USD",
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "userld",
    },
  },
  {
    tableName: "strategies",
    timestamps: true, // adds createdAt and updatedAt
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["title"],
      },
      {
        fields: ["type"],
      },
    ],
  },
);

export default Strategy;
