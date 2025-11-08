import { courponService } from "../services/couponService.js";

export const couponController = {
  getCoupons: async (req, res) => {
    try {
      const coupons = await courponService.getCoupons();
      return res.status(201).json(coupons);
    } catch (error) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: error.message,
        data: null,
      });
    }
  },
  getCoupon: async (req, res) => {
    try {
      const coupon = await courponService.getCoupon(req.params.id);
      return res.status(201).json(coupon);
    } catch (error) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: error.message,
        data: null,
      });
    }
  },
  createCoupon: async (req, res) => {
    try {
      const coupon = await courponService.createCoupon(req.body);
      return res.status(201).json(coupon);
    } catch (error) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: error.message,
        data: null,
      });
    }
  },
  updateCoupon: async (req, res) => {
    try {
      const coupon = await courponService.updateCoupon(req.body);
      return res.status(200).json(coupon);
    } catch (error) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: error.message,
        data: null,
      });
    }
  },
  deleteCoupon: async (req, res) => {
    try {
      const coupon = await courponService.deleteCoupon(req.params.id);
      return res.status(200).json(coupon);
    } catch (error) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: error.message,

        data: null,
      });
    }
  },

  bulkDelete: async (req, res) => {
    try {
      const coupons = await courponService.bulkDelete(req.body);
      return res.status(200).json(coupons);
    } catch (error) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: error.message,
        data: null,
      });
    }
  },

  validateCoupon: async (req, res) => {
    try {
      const { code, plan_code } = req.body;
      const coupon = await courponService.validateCoupon(code, plan_code);
      return res.status(coupon.code).json(coupon);
    } catch (error) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: error.message,
        data: null,
      });
    }
  },
};
