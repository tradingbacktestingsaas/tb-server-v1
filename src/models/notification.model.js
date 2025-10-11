import { DataTypes } from "sequelize";
import { sequelize } from '../config/db.js';

const Notification = sequelize.define(
  "notification",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.STRING, // varchar
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    data: {
      type: DataTypes.JSONB,
      allowNull: true, // can store metadata, links, etc.
    },
    is_read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    viewed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    deletion_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "notification",
    timestamps: true, // adds createdAt & updatedAt
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export default Notification;
