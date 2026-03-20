import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const BUG_PRIORITY = ["low", "medium", "high", "critical"];
const BUG_STATUS = ["open", "in_progress", "resolved", "closed"];

const BugReport = sequelize.define(
  "bug_report",
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

    priority: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "medium",
      validate: {
        isIn: {
          args: [BUG_PRIORITY],
          msg: "Invalid priority value",
        },
      },
    },

    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "open",
      validate: {
        isIn: {
          args: [BUG_STATUS],
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

export default BugReport;
