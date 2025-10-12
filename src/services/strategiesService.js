import Strategies from "../models/strategies.model.js";
import { Op, Sequelize, where } from "sequelize";

export async function createStrategies(strategiesDetails) {
  try {
    const strategies = await Strategies.create(strategiesDetails);
    if (!strategies) {
      throw new Error("Strategies not created");
    }
    return {
      code: 201,
      message: "Strategies created successfully",
      data: strategies,
      success: true,
    };
  } catch (error) {
    console.error("Error in createStrategies service:", error);
    throw new Error(`Failed to create strategies: ${error}`);
  }
}

export async function getStrategies(query = {}) {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "created_at",
      sortOrder = "DESC",
      // filters
      id,
      status,
      type,
      isPremium,
      userId,
    } = query;

    const whereClause = {};
    if (id) whereClause.id = id;
    if (status) whereClause.status = status;
    if (type) whereClause.type = type;
    if (typeof isPremium !== "undefined" && isPremium !== "") {
      // accept "true"/"false" or boolean
      whereClause.isPremium = String(isPremium).toLowerCase() === "true" || isPremium === true;
    }
    if (userId) whereClause.userId = userId;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const offset = (pageNum - 1) * limitNum;
    const order = [[sortBy, String(sortOrder).toUpperCase() === "ASC" ? "ASC" : "DESC"]];

    const { rows, count } = await Strategies.findAndCountAll({
      where: whereClause,
      offset,
      limit: limitNum,
      order,
    });

    return {
      code: 200,
      message: "Strategies fetched successfully",
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum) || 1,
      },
    };
  } catch (error) {
    console.error("Error in getStrategies service:", error);
    throw new Error(`Failed to fetch strategies: ${error}`);
  }
}

export async function updateStrategies(body) {
  try {

    if (!body.id) {
      return {
        code: 400,
        message: "Strategies ID is required",
        success: false,
      };
    }
    const strategies = await Strategies.update(body, {
      where: { id: body.id },
    });
    if (!strategies) {
      throw new Error("Strategies not updated");
    }
    return {
      code: 200,
      message: "Strategies updated successfully",
      data: strategies,
      success: true,
    };
  } catch (error) {
    console.error("Error in updateStrategies service:", error);
    throw new Error(`Failed to update strategies: ${error}`);
  }
}

export async function deleteStrategies(body) {
  try {
    if (!body.id) {
      return {
        code: 400,
        message: "Strategies ID is required",
        success: false,
      };
    }
    const strategies = await Strategies.destroy({
      where: { id: body.id },
    });
    if (!strategies) {
      throw new Error("Strategies not deleted");
    }
    return {
      code: 200,
      message: "Strategies deleted successfully",
      data: strategies,
      success: true,
    };
  } catch (error) {
    console.error("Error in deleteStrategies service:", error);
    throw new Error(`Failed to delete strategies: ${error}`);
  }
}

export const strategiesService = {
  createStrategies,
  getStrategies,
  updateStrategies,
  deleteStrategies,
};
