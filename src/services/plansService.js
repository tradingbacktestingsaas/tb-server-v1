import Plans from "../models/plan.model.js";
import { Op, Sequelize, where } from "sequelize";

export async function createPlans(plansDetails) {
  try {
    const plans = await Plans.create(plansDetails);
    if (!plans) {
      return {
        code: 404,
        success: false,
        message: "Plans not created",
        data: null,
      };
    }
    return {
      code: 201,
      success: true,
      message: "Plans created successfully",
      data: plans,
    };
  } catch (error) {
    console.error("Error in createPlans service:", error);
    throw new Error(`Failed to create plans: ${error}`);
  }
}

export async function getPlans() {
  try {
    const plans = await Plans.findAll();
    if (!plans) {
      return {
        code: 404,
        success: false,
        message: "Plans not found",
        data: null,
     
      };
    }
    return {
      code: 200,
      success: true,
      message: "Plans fetched successfully",
      data: plans,
    };
  } catch (error) {
    console.error("Error in getPlans service:", error);
    throw new Error(`Failed to get plans: ${error}`);
  }
}

export const plansService = {
  createPlans,
  getPlans
};
