import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const FEEDBACK_STATUS = ["open", "in_progress", "resolved", "closed"];

const Feedback = sequelize.define(
  "feedback",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    category: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "open",
      validate: {
        isIn: {
          args: [FEEDBACK_STATUS],
          msg: "Invalid status value",
        },
      },
    },

    attachments: {
      type: DataTypes.JSON,
      allowNull: true,
    },

    resolution: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    resolvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    timestamps: true,
  },
);

export default Feedback;
