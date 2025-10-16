import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const UserNotification = sequelize.define(
  "user_notification",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID, // varchar
      allowNull: true,
    },
    notificationId: {
      type: DataTypes.UUID, // varchar
      allowNull: true,
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
    tableName: "user_notification",
    timestamps: true, // adds createdAt & updatedAt
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export default UserNotification;
