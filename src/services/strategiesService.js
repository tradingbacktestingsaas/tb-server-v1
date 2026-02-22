import Strategies from "../models/strategies.model.js";
import UserSubscription from "../models/user_subscription.model.js";
import Order from "../models/order.model.js";
import Users from "../models/user.model.js";
import stripeService from "./stripeService.js";
import { Op, Sequelize, where } from "sequelize";
import User from "../models/user.model.js";
import PurchasedStrategies from "../models/purchased_strategies.model.js";
import Plan from "../models/plan.model.js";
import { createNotification } from "./notificationService.js";

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

export async function getStrategies(query = {}, authUserId = null) {
  try {
    /* ============================================================
       1️⃣ Safe Query Extraction
    ============================================================ */

    const {
      page = 1,
      limit = 10,
      sortBy = "created_at",
      sortOrder = "DESC",
      filters = {},
    } = query;

    const { id, status, type, isPremium, byUserId } = filters;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    /* ============================================================
       2️⃣ Whitelist Sorting (Prevent SQL Injection)
    ============================================================ */

    const allowedSortFields = [
      "created_at",
      "updated_at",
      "price",
      "name",
      "type",
    ];

    const safeSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : "created_at";

    const safeSortOrder =
      String(sortOrder).toUpperCase() === "ASC" ? "ASC" : "DESC";

    const order = [[safeSortBy, safeSortOrder]];

    /* ============================================================
       3️⃣ Fetch Auth User (Role + Plan)
    ============================================================ */

    let userRole = null;
    let userPlan = "FREE";
    let isAdmin = false;
    console.log(authUserId);

    if (authUserId) {
      const user = await User.findByPk(authUserId, {
        attributes: ["role"],
        include: [
          {
            model: UserSubscription,
            as: "subscriptions",
            required: false,
            where: { status: "active" },
            include: [
              {
                model: Plan,
                as: "plan",
                attributes: ["code"],
              },
            ],
          },
        ],
      });

      userRole = user?.role || null;
      isAdmin = userRole === "admin";

      const activeSub =
        user.subscriptions.status === "active" ? user.subscriptions : null;
      userPlan = activeSub?.plan?.code?.toUpperCase() || "FREE";
      console.log(user);
    }
    console.log(userPlan);

    const isElite = userPlan === "ELITE";

    /* ============================================================
       4️⃣ Build WHERE Clause
    ============================================================ */

    const where = {};

    if (id) where.id = id;
    if (byUserId) where.userId = byUserId;

    /* =============================
       Status Control
    ============================== */

    if (isAdmin) {
      if (status) where.status = status;
    } else {
      // Non-admin only sees active
      where.status = "active";
    }

    /* =============================
       Premium Filter
    ============================== */

    if (typeof isPremium !== "undefined") {
      where.isPremium =
        isPremium === true || String(isPremium).toLowerCase() === "true";
    }

    /* =============================
       Plan-Based Type Visibility
    ============================== */

    if (!isAdmin) {
      if (isElite) {
        where.type = { [Op.in]: ["ELITE", "ADDON"] };
      } else {
        where.type = "ADDON";
      }
    }

    /* =============================
       Safe Type Override (No Escalation)
    ============================== */

    if (type) {
      if (isAdmin) {
        where.type = type;
      } else if (isElite && ["ELITE", "ADDON"].includes(type)) {
        where.type = type;
      } else if (!isElite && type === "ADDON") {
        where.type = type;
      }
    }

    /* ============================================================
       5️⃣ Fetch Strategies
    ============================================================ */

    const { rows, count } = await Strategies.findAndCountAll({
      where,
      offset,
      limit: limitNum,
      order,
    });

    /* ============================================================
       6️⃣ Purchase Detection (Optimized)
    ============================================================ */

    let purchasedSet = new Set();

    if (authUserId && rows.length > 0) {
      const purchases = await PurchasedStrategies.findAll({
        attributes: ["strategyId"],
        where: {
          userId: authUserId,
        },
        include: [
          {
            model: Strategies,
            as: "strategiesInfo",
            attributes: [
              "id",
              "title",
              "comment",
              "status",
              "type",
              "isPremium",
              "hasPrice",
              "price",
              "currency",
            ],
          },
        ],
      });

      purchasedSet = new Set(purchases.map((p) => p.strategyId));
    }

    /* ============================================================
       7️⃣ Attach Purchase Flag
    ============================================================ */

    const data = rows.map((strategy) => {
      const json = strategy.toJSON();
      json.isPurchased = purchasedSet.has(json.id);
      return json;
    });

    /* ============================================================
       8️⃣ Response
    ============================================================ */

    return {
      code: 200,
      success: true,
      message: "Strategies fetched successfully",
      data,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum) || 1,
      },
    };
  } catch (error) {
    console.error("Error in getStrategies:", error);
    throw new Error(`Failed to fetch strategies: ${error.message || error}`);
  }
}

export async function getPurchasedStrategies(query = {}, authUserId = null) {
  try {
    /* ============================================================
       1️⃣ Safe Query Extraction + Sanitization
    ============================================================ */

    const {
      page = 1,
      limit = 10,
      sortBy = "created_at",
      sortOrder = "DESC",
      filters = {},
    } = query;

    const { userId, strategyId, type, isPremium } = filters;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    /* ============================================================
       2️⃣ Whitelist Sort Columns (Prevent SQL Injection)
    ============================================================ */

    const allowedSortFields = [
      "created_at",
      "updated_at",
      "strategy.price",
      "strategy.type",
      "strategy.title",
    ];

    const safeSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : "created_at";

    const safeSortOrder =
      String(sortOrder).toUpperCase() === "ASC" ? "ASC" : "DESC";

    const order = [[safeSortBy, safeSortOrder]];

    /* ============================================================
       3️⃣ Build WHERE Clause Safely
    ============================================================ */

    const where = {};

    // If userId filter provided, use it; otherwise use authUserId if available
    const filterUserId = userId || authUserId;
    if (filterUserId) {
      where.userId = filterUserId;
    }

    if (strategyId) where.strategyId = strategyId;

    /* ============================================================
       4️⃣ Build Include Clause with Strategy Details
    ============================================================ */

    const strategyWhere = {};

    if (typeof isPremium !== "undefined") {
      strategyWhere.isPremium =
        isPremium === true || String(isPremium).toLowerCase() === "true";
    }

    if (type) {
      strategyWhere.type = type;
    }

    const include = [
      {
        model: Strategies,
        as: "strategiesInfo",
        attributes: [
          "id",
          "title",
          "comment",
          "status",
          "type",
          "isPremium",
          "hasPrice",
          "price",
          "currency",
          "created_at",
          "updated_at",
        ],
        where:
          Object.keys(strategyWhere).length > 0 ? strategyWhere : undefined,
        required: Object.keys(strategyWhere).length > 0,
      },
    ];

    /* ============================================================
       5️⃣ Fetch Purchased Strategies with Includes
    ============================================================ */

    const { rows, count } = await PurchasedStrategies.findAndCountAll({
      where,
      include,
      offset,
      limit: limitNum,
      order,
      distinct: true, // For accurate count with includes
      subQuery: false,
    });

    /* ============================================================
       6️⃣ Response
    ============================================================ */

    return {
      code: 200,
      success: true,
      message: "Purchased strategies fetched successfully",
      data: rows,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum) || 1,
      },
    };
  } catch (error) {
    console.error("Error in getPurchasedStrategies:", error);
    throw new Error(`Failed to fetch purchased strategies: ${error.message}`);
  }
}

export async function getUserPurchasedStrategies(userId) {
  try {
    const strategies = await PurchasedStrategies.findAll({
      where: { userId },
      include: [
        {
          model: Strategies,
          as: "strategiesInfo",
          attributes: [
            "id",
            "title",
            "comment",
            "status",
            "type",
            "isPremium",
            "hasPrice",
            "price",
            "currency",
          ],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    return {
      code: 200,
      success: true,
      message: "User purchased strategies fetched successfully",
      data: strategies,
    };
  } catch (error) {
    console.error("Error in getUserPurchasedStrategies:", error);
    throw new Error(
      `Failed to fetch user purchased strategies: ${error.message}`,
    );
  }
}

// export async function getStrategies(query = {}) {
//   try {
//     const {
//       page = 1,
//       limit = 10,
//       sortBy = "created_at",
//       sortOrder = "DESC",
//       filters = {},
//       purchaser_user_id,
//     } = query;

//     const { id, status, type, isPremium, userId, byUserId } = filters;

//     // 1️⃣ Fetch user plan if userId is provided
//     let userPlan = null;
//     if (userId) {
//       const user = await User.findByPk(userId);
//       userPlan = user?.plan || null;
//     }

//     // 2️⃣ Build where clause
//     const whereClause = {};

//     if (id) whereClause.id = id;
//     if (status) whereClause.status = status;

//     if (typeof isPremium !== "undefined" && isPremium !== "") {
//       whereClause.isPremium = [true, "true"].includes(
//         isPremium === true ? true : String(isPremium).toLowerCase()
//       );
//     }

//     if (userPlan === "ELITE") {
//       if (type === "ELITE") {
//         whereClause.type = "ELITE";
//       } else if (type) {
//         whereClause.type = type;
//       }
//     } else {
//       // Non-ELITE users
//       if (type === "PERSONAL") {
//         whereClause.type = "PERSONAL";
//         whereClause.userId = userId;
//       } else {
//         whereClause.type = { [Op.ne]: "ELITE" };
//       }
//     }

//     // ❗ Always hide PERSONAL strategies from other users
//     if (userId) {
//       whereClause[Op.or] = [
//         { type: { [Op.ne]: "PERSONAL" } }, // allow all non-personal strategies
//         { userId: userId }, // allow only MY personal strategies
//       ];
//     }

//     if (byUserId) whereClause.userId = byUserId;

//     // 3️⃣ Pagination & sorting
//     const pageNum = Math.max(parseInt(page, 10) || 1, 1);
//     const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
//     const offset = (pageNum - 1) * limitNum;

//     const order = [
//       [sortBy, String(sortOrder).toUpperCase() === "ASC" ? "ASC" : "DESC"],
//     ];

//     // 4️⃣ Fetch strategies
//     const { rows, count } = await Strategies.findAndCountAll({
//       where: whereClause,
//       offset,
//       limit: limitNum,
//       order,
//     });

//     // 5️⃣ Fetch purchased strategy IDs if purchaser_user_id provided
//     let purchasedStrategyIds = new Set();
//     if (purchaser_user_id) {
//       const userOrders = await Order.findAll({
//         attributes: ["strategyId"],
//         where: {
//           userId: purchaser_user_id,
//           orderType: "strategy",
//           status: "paid",
//         },
//       });
//       purchasedStrategyIds = new Set(
//         userOrders.map((o) => o.strategyId).filter(Boolean)
//       );
//     }

//     // 6️⃣ Mark purchased strategies
//     const dataWithPurchase = rows.map((s) => {
//       const json = s.toJSON();
//       json.is_purchase = purchasedStrategyIds.has(json.id);
//       return json;
//     });

//     return {
//       code: 200,
//       message: "Strategies fetched successfully",
//       success: true,
//       data: dataWithPurchase,
//       pagination: {
//         total: count,
//         page: pageNum,
//         limit: limitNum,
//         totalPages: Math.ceil(count / limitNum) || 1,
//       },
//     };
//   } catch (error) {
//     console.error("Error in getStrategies service:", error);
//     throw new Error(`Failed to fetch strategies: ${error.message || error}`);
//   }
// }

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

export async function buyStrategy(body) {
  try {
    const userId = body.userId || body.user_id;
    const strategyId = body.strategyId || body.id; // support body.id as strategy id per existing pattern
    const paymentMethodId = body.paymentMethodId;

    if (!userId || !strategyId || !paymentMethodId) {
      return {
        code: 400,
        message: "Missing required fields: userId, strategyId, paymentMethodId",
        success: false,
        data: null,
      };
    }

    const [user, strategy] = await Promise.all([
      Users.findByPk(userId),
      Strategies.findByPk(strategyId),
    ]);

    if (!user) {
      return {
        code: 404,
        message: "User not found",
        success: false,
        data: null,
      };
    }
    if (!strategy) {
      return {
        code: 404,
        message: "Strategy not found",
        success: false,
        data: null,
      };
    }
    if (!strategy.hasPrice || !strategy.price) {
      return {
        code: 400,
        message: "Strategy is not purchasable",
        success: false,
        data: null,
      };
    }

    // Compute amount in cents
    const amountCents = Math.round(Number(strategy.price) * 100);
    const currency = String(strategy.currency || "USD").toLowerCase();

    // Ensure a Stripe customer exists and the payment method is associated
    const customer = await stripeService.getOrCreateCustomerByEmail(
      user.email,
      [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined,
    );
    try {
      await stripeService.attachPaymentMethodToCustomer(
        paymentMethodId,
        customer.id,
      );
    } catch (e) {
      // Ignore if it's already attached to this customer
    }

    // Process payment with Stripe using Payment Intents (confirm immediately)
    const payment = await stripeService.processPayment({
      amount: amountCents,
      currency,
      payment_method: paymentMethodId,
      customerId: customer.id,
      description: `Purchase strategy: ${strategy.title}`,
      customer_email: user.email,
    });

    const isPaid = payment.status === "succeeded";

    // Create Order entry; set requested fields to null per instruction
    const orderPayload = {
      userId: user.id,
      planId: null,
      planCode: null,
      amountSubtotalCents: amountCents,
      amountDiscountCents: 0,
      amountTotalCents: amountCents,
      currency: String(strategy.currency || "USD").toUpperCase(),
      provider: null,
      providerCheckoutSessionId: null,
      status: isPaid ? "paid" : "failed",
      couponId: null,
      invoiceId: null,
      hostedInvoiceUrl: null,
      provider_sub_id: null,
      order_type: "strategy",
      strategyId: strategy.id,
    };

    const order = await Order.create(orderPayload);
    await createNotification({
      userId: order.userId,
      title: "Your subscription ist started!",
      type: "alert",
      message:
        "Your subscription is now active. You can start connecting your live accounts.",
    });
    const purchasedStrategy = await PurchasedStrategies.create({
      userId: user.id,
      strategyId: strategy.id,
    });

    return {
      code: 200,
      message: isPaid ? "Strategy purchased successfully" : "Payment failed",
      success: isPaid,
      data: {
        order,
        payment,
        purchasedStrategy,
      },
    };
  } catch (error) {
    console.error("Error in buyStrategy service:", error);
    throw new Error(`Failed to buy strategy: ${error}`);
  }
}

const bulkCreateStrategy = async (details) => {
  try {
    if (!details) {
      throw new Error("Trade account details not found");
    }

    const tradeAccs = await Strategies.bulkCreate(details, {
      validate: true,
      returning: true,
      ignoreDuplicates: true,
    });

    if (!tradeAccs) {
      throw new Error("Trade accounts not created");
    }

    return {
      message: "Trade accounts created successfully",
      data: tradeAccs,
      success: true,
    };
  } catch (error) {
    console.error("Error in bulkCreateTradeAccs service:", error);
    throw new Error(`Failed to create trade accounts: ${error}`);
  }
};

export const strategiesService = {
  createStrategies,
  getStrategies,
  updateStrategies,
  deleteStrategies,
  buyStrategy,
  bulkCreateStrategy,
  getPurchasedStrategies,
};
