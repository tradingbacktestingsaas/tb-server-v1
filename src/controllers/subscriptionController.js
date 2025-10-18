import { subscriptionService } from "../services/subscriptionService.js";

const subscribe = async (req, res) => {
  try {
    const subscription = await subscriptionService.subscribe(req.body);
    return res.status(201).json(subscription);
  } catch (error) {
    return res.status(error.code || 500).json({
      code: error.code || 500,
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

export const subscriptionController = {
  subscribe,
};
