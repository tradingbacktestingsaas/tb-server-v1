import Plans from "../models/plan.model.js";
import { Op, Sequelize, where } from "sequelize";
import User from "../models/user.model.js";
import UserSubscription from "../models/user_subscription.model.js";

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

export async function getPlans(query = {}) {
  try {
    const plans = await Plans.findAll();

    const userId = query.userId || query.user_id;
    let currentPlan = null;
    console.log(query);
    
    if (userId) {
      const user = await User.findByPk(userId, {
        attributes: ["id", "plan"],
        include: [
          {
            model: UserSubscription,
            as: "subscriptions",
            required: false,
            include: [
              {
                model: Plans,
                as: "plan",
                required: false,
              },
            ],
          },
        ],
      });

      if (!user) {
        return {
          code: 404,
          success: false,
          message: "User not found",
          data: plans,
          current_plan: null,
        };
      }

      currentPlan = user?.subscriptions?.[0]?.plan || null;
      
      if (!currentPlan && user?.plan) {
        currentPlan =
          plans.find((plan) => plan.code === user.plan) ||
          (await Plans.findOne({ where: { code: user.plan } }));
      }
    }

    return {
      code: 200,
      success: true,
      message: "Plans fetched successfully",
      data: plans,
      current_plan: currentPlan,
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
