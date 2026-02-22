import UserPersonalStrategy from "../models/user_personal_strategy.model.js";
import { Op } from "sequelize";

export async function createUserPersonalStrategy(strategyDetails) {
  try {
    if (!strategyDetails.user_id) {
      throw new Error("user_id is required");
    }

    const strategy = await UserPersonalStrategy.create(strategyDetails);
    if (!strategy) {
      throw new Error("User Personal Strategy not created");
    }
    return {
      code: 201,
      message: "User Personal Strategy created successfully",
      data: strategy,
      success: true,
    };
  } catch (error) {
    console.error("Error in createUserPersonalStrategy service:", error);
    throw new Error(
      `Failed to create user personal strategy: ${error.message}`,
    );
  }
}

export async function getUserPersonalStrategies(query = {}) {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "created_at",
      sortOrder = "DESC",
      filters = {},
    } = query;

    const { id, user_id, title, status, type, isPremium } = filters;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    const validSortBy = [
      "id",
      "user_id",
      "title",
      "status",
      "type",
      "created_at",
      "updated_at",
    ];
    const safeSortBy = validSortBy.includes(sortBy) ? sortBy : "created_at";
    const safeSortOrder = ["ASC", "DESC"].includes(sortOrder?.toUpperCase())
      ? sortOrder.toUpperCase()
      : "DESC";
    const order = [[safeSortBy, safeSortOrder]];

    const where = {};

    if (id) where.id = id;
    if (user_id) where.user_id = user_id;
    if (title) where.title = { [Op.like]: `%${title}%` };
    if (status) where.status = status;
    if (type) where.type = type;

    if (typeof isPremium !== "undefined") {
      where.isPremium =
        isPremium === true || String(isPremium).toLowerCase() === "true";
    }

    const { count, rows } = await UserPersonalStrategy.findAndCountAll({
      where,
      offset,
      limit: limitNum,
      order,
      distinct: true,
    });

    return {
      code: 200,
      message: "User Personal Strategies retrieved successfully",
      data: rows,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum),
      },
      success: true,
    };
  } catch (error) {
    console.error("Error in getUserPersonalStrategies service:", error);
    throw new Error(`Failed to get user personal strategies: ${error.message}`);
  }
}

export async function getUserPersonalStrategyById(id) {
  try {
    if (!id) {
      throw new Error("Strategy ID is required");
    }

    const strategy = await UserPersonalStrategy.findByPk(id);
    if (!strategy) {
      return {
        code: 404,
        message: "User Personal Strategy not found",
        data: null,
        success: false,
      };
    }

    return {
      code: 200,
      message: "User Personal Strategy retrieved successfully",
      data: strategy,
      success: true,
    };
  } catch (error) {
    console.error("Error in getUserPersonalStrategyById service:", error);
    throw new Error(`Failed to get user personal strategy: ${error.message}`);
  }
}

export async function updateUserPersonalStrategy(strategyDetails) {
  try {
    const { id, ...updateData } = strategyDetails;
    console.log(updateData);

    if (!id) {
      throw new Error("Strategy ID is required");
    }

    const strategy = await UserPersonalStrategy.findByPk(id);
    if (!strategy) {
      return {
        code: 404,
        message: "User Personal Strategy not found",
        data: null,
        success: false,
      };
    }

    // Prevent user_id modification
    delete updateData.user_id;

    await strategy.update(updateData);

    return {
      code: 200,
      message: "User Personal Strategy updated successfully",
      data: strategy,
      success: true,
    };
  } catch (error) {
    console.error("Error in updateUserPersonalStrategy service:", error);
    throw new Error(
      `Failed to update user personal strategy: ${error.message}`,
    );
  }
}

export async function deleteUserPersonalStrategy(id) {
  try {
    if (!id) {
      throw new Error("Strategy ID is required");
    }

    const strategy = await UserPersonalStrategy.findByPk(id);
    if (!strategy) {
      return {
        code: 404,
        message: "User Personal Strategy not found",
        data: null,
        success: false,
      };
    }

    await strategy.destroy();

    return {
      code: 200,
      message: "User Personal Strategy deleted successfully",
      data: null,
      success: true,
    };
  } catch (error) {
    console.error("Error in deleteUserPersonalStrategy service:", error);
    throw new Error(
      `Failed to delete user personal strategy: ${error.message}`,
    );
  }
}

export async function getUserStrategiesByUserId(userId) {
  try {
    if (!userId) {
      throw new Error("User ID is required");
    }

    const strategies = await UserPersonalStrategy.findAll({
      where: { user_id: userId },
      order: [["created_at", "DESC"]],
    });

    return {
      code: 200,
      message: "User strategies retrieved successfully",
      data: strategies,
      success: true,
    };
  } catch (error) {
    console.error("Error in getUserStrategiesByUserId service:", error);
    throw new Error(`Failed to get user strategies: ${error.message}`);
  }
}

export const userPersonalStrategyService = {
  createUserPersonalStrategy,
  getUserPersonalStrategies,
  getUserPersonalStrategyById,
  updateUserPersonalStrategy,
  deleteUserPersonalStrategy,
  getUserStrategiesByUserId,
};
