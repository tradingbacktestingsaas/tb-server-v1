import { plansService } from "../services/plansService.js";

const createPlans = async (req, res) => {
  try {
    const plans = await plansService.createPlans(req.body);
    return res.status(201).json(plans);
  } catch (error) {
    return res.status(error.code || 500).json({
      code: error.code || 500,
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

const getPlans = async (req, res) => {
  try {
    console.log(req.query);
    
    const plans = await plansService.getPlans(req.query);
    return res.status(200).json(plans);
  } catch (error) {
    return res.status(error.code || 500).json({
      code: error.code || 500,
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};


export const plansController = {
  createPlans,
  getPlans,
};
