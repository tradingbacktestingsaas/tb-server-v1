import { OrderService } from "../services/ordersService.js";

const getOrders = async (req, res) => {
  try {
    const orders = await OrderService.getOrders(req.query);
    return res.status(200).json(orders);
  } catch (error) {
    return res.status(error.code || 500).json({
      code: error.code || 500,
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

export const OrdesController = {
  getOrders,
};
