import { DataTypes } from "sequelize";
import { sequelize } from '../config/db.js';

const Admin = sequelize.define(
  "Admin",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    first_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    last_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING(255),
      allowNull: false, // e.g. 'superadmin', 'editor'
    },
    active: {
      type: DataTypes.INTEGER, // 0 = inactive, 1 = active
      allowNull: false,
      defaultValue: 1,
    },
    created: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "admin",
    timestamps: false, // only `created` exists
  }
);

export default Admin;
