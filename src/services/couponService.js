import Coupon from "../models/coupon.model";
import Plan from "../models/plan.model";

const createCoupon = async (coupon) => {
  const created = await Coupon.create(coupon);
  if (!created) {
    return {
      code: 404,
      success: false,
      message: "Coupon not created",
      data: null,
    };
  }
  return {
    code: 201,
    message: "Coupon created successfully",
    data: created,
    success: true,
  };
};

const updateCoupon = async (coupon) => {
  const updated = await Coupon.update(coupon, { where: { id: coupon.id } });
  if (!updated) {
    return {
      code: 404,
      success: false,
      message: "Coupon not updated",
      data: null,
    };
  }
  return {
    code: 200,
    message: "Coupon updated successfully",
    data: updated,
    success: true,
  };
};

const getCoupon = async (id) => {
  const coupon = await Coupon.findByPk(id);
  if (!coupon) {
    return {
      code: 404,
      success: false,
      message: "Coupon not found",
      data: null,
    };
  }
  return {
    code: 200,
    message: "Coupon found successfully",
    data: coupon,
    success: true,
  };
};

const deleteCoupon = async (id) => {
  const deleted = await Coupon.destroy({ where: { id } });
  if (!deleted) {
    return {
      code: 404,
      success: false,
      message: "Coupon not deleted",
      data: null,
    };
  }
  return {
    code: 200,
    message: "Coupon deleted successfully",
    data: deleted,
    success: true,
  };
};

const getCoupons = async () => {
  const coupons = await Coupon.findAll();
  if (!coupons) {
    return {
      code: 404,
      success: false,
      message: "Coupons not found",
      data: null,
    };
  }
  return {
    code: 200,
    message: "Coupons found successfully",
    data: coupons,
    success: true,
  };
};

const bulkDelete = async (body) => {
  const coupons = await Coupon.bulkDelete(body);
  if (!coupons) {
    return {
      code: 404,
      success: false,
      message: "Coupons not bulk deleted",
      data: null,
    };
  }
  return {
    code: 200,
    message: "Coupons deleted successfully",
    data: coupons,
    success: true,
  };
};

const validateCoupon = async (code, plan_code) => {
  const coupon = await Coupon.findOne({ where: { code, isActive: true } });

  if (!coupon) {
    return {
      code: 404,
      success: false,
      message: "Coupon not found",
      data: null,
    };
  }

  if (coupon.expiryDate < new Date()) {
    return {
      code: 400,
      success: false,
      message: "Coupon expired",
      data: null,
    };
  }

  if (!(c.applies_to === plan_code || coupon.applies_to === "all")) {
    return {
      code: 400,
      success: false,
      message: "Coupon not applicable to this plan",
      data: null,
    };
  }

  return {
    code: 200,
    message: "Coupon found successfully",
    data: coupon,
    success: true,
  };
};

export const courponService = {
  createCoupon,
  updateCoupon,
  getCoupon,
  deleteCoupon,
  getCoupons,
  validateCoupon,
  bulkDelete,
};
