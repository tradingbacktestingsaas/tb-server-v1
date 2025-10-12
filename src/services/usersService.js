import User from "../models/user.model.js";
import { Op, Sequelize } from "sequelize";
import { encrypt } from "../utils/cryptoUtil.js";

export async function getUsers(options = {}) {
  try {
    const {
      firstName,
      lastName,
      email,
      blocked,
      limit = 10,
      offset = 0,
    } = options;

    const where = {};

    if (firstName) {
      where.firstName = { [Op.iLike]: `%${firstName}%` };
    }

    if (lastName) {
      where.lastName = { [Op.iLike]: `%${lastName}%` };
    }

    if (email) {
      where.email = { [Op.iLike]: `%${email}%` };
    }

    if (typeof blocked === "boolean") {
      where.blocked = blocked;
    }

    const { count, rows } = await User.findAndCountAll({
      attributes: [
        "id",
        "firstName",
        "lastName",
        "email",
        "blocked",
        "avatar_url",
        "createdAt",
        "updatedAt",
        "role",
        "plan",
      ],
      where,
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    return {
      users: rows,
      totalCount: count,
      success: true,
      message: "Users fetched successfully",
    };
  } catch (error) {
    console.error("Error in getUsers service:", error);
    throw new Error(`Failed to fetch users: ${error.message || error}`);
  }
}

export async function getUserById(userId) {
  try {
    const user = await User.findByPk(userId, {
      order: [["createdAt", "DESC"]],
      attributes: [
        "id",
        "firstName",
        "lastName",
        "email",
        "blocked",
        "avatar_url",
        "createdAt",
        "updatedAt",
        "role",
        "plan",
      ],
    });
    if (!user) {
      throw new Error("User not found");
    }
    return {
      message: "User fetched successfully",
      data: user,
      success: true,
    };
  } catch (error) {
    console.error("Error in getUserById service:", error);
    throw new Error(`Failed to fetch user: ${error}`);
  }
}

export async function bulkCreateUsers(userDetail) {
  try {
    const users = await User.bulkCreate(userDetail, {
      validate: true,
      returning: true,
      ignoreDuplicates: true,
    });

    if (!users) {
      throw new Error("Users not created");
    }

    return {
      message: "Users created successfully",
      data: users,
      success: true,
    };
  } catch (error) {
    console.error("Error in createBulkUsers service:", error);
    throw new Error(`Failed to create users: ${error}`);
  }
}

export async function bulkDeleteUsers(userId) {
  try {
    const users = await User.destroy({
      where: {
        id: {
          [Op.in]: userId,
        },
      },
    });

    if (!users) {
      throw new Error("Users not found");
    }

    return {
      message: "Users deleted successfully",
      data: users,
      success: true,
    };
  } catch (error) {
    console.error("Error in deleteBulkUsers service:", error);
    throw new Error(`Failed to delete users: ${error}`);
  }
}

const deleteUser = async (userId) => {
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error("User not found");
    }
    await user.destroy();
    return {
      message: "User deleted successfully",
      data: user,
      success: true,
    };
  } catch (error) {
    console.error("Error in deleteUser service:", error);
    throw new Error(`Failed to delete user: ${error}`);
  }
};

const updateUser = async (userId, userDetail) => {
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const updatedUser = await user.update(userDetail);
    if (!updatedUser) {
      throw new Error("User not updated");
    }

    return {
      message: "User updated successfully",
      data: user,
      success: true,
    };
  } catch (error) {
    console.error("Error in updateUser service:", error);
    throw new Error(`Failed to update user: ${error}`);
  }
};

async function changePassword(userId, newPassword) {
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error("User not found");
    }
    user.password = encrypt(newPassword);;
    await user.save();
    return {
      message: "Password changed successfully",
      data: user,
      success: true,
    };
  } catch (error) {
    console.error("Error in changePassword service:", error);
    throw new Error(`Failed to change password: ${error}`);
  }
}

export const usersService = {
  bulkCreateUsers,
  bulkDeleteUsers,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  changePassword,
};
