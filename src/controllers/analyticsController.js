import Trade from "../models/trade.model";

const tradeAnalytics = async (req, res) => {
  try {
    const user = await usersService.uploadAvatar(req.params.id, req);
    return res.status(201).json(user);
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error.message,
      data: null,
    });
  }
};
