import { Op, Sequelize } from "sequelize";
import Order from "../models/order.model.js";
import User from "../models/user.model.js";
import Plan from "../models/plan.model.js";
import Strategy from "../models/strategies.model.js";

export async function getOrders({ limit = 10, page = 0, filters }) {
  try {
    const where = {};
    const jsonFilters =
      typeof filters === "string" ? JSON.parse(filters) : filters || {};

    const { userId, planId, status, date, startDate, endDate } = jsonFilters;

    // 🔹 Filter by createdAt date
    if (date) {
      if (typeof date === "object" && date.start && date.end) {
        where.created_at = {
          [Op.between]: [new Date(date.start), new Date(date.end)],
        };
      } else {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        where.created_at = { [Op.between]: [start, end] };
      }
    }

    if (status) where.status = status;
    if (userId) where.userId = userId;
    if (planId) where.planId = planId;

    // 🔹 Query Orders
    const { count, rows } = await Order.findAndCountAll({
      where,
      limit,
      page,
      order: [["created_at", "DESC"]],
      attributes: [
        "id",
        "userId",
        "planId",
        "strategyId",
        "planCode",
        "amountSubtotalCents",
        "amountDiscountCents",
        "amountTotalCents",
        "currency",
        "status",
        "cycle",
        "provider",
        "providerCheckoutSessionId",
        "invoiceId",
        "hostedInvoiceUrl",
        "created_at",
        "updated_at",

        // 🧮 Custom derived attribute: amountTotal in dollars
        [
          Sequelize.literal(`"amount_total_cents" / 100.0`),
          "amountTotalDollars",
        ],
      ],
      include: [
        {
          model: User,
          as: "user",
          attributes: [
            "id",
            "firstName",
            "lastName",
            "email",
            "avatar_url",
            // 🧮 Optional computed field for convenience
            [
              Sequelize.literal(
                `"user"."firstName" || ' ' || "user"."lastName"`
              ),
              "fullName",
            ],
          ],
        },
        {
          model: Plan,
          as: "plan",
          attributes: ["id", "name", "price_cents", "features", "code"],
        },
        {
          model: Strategy,
          as: "strategy",
          attributes: ["id", "title", "price", "type"],
        },
      ],
    });

    return {
      orders: rows,
      totalCount: count,
      success: true,
      message: "Orders fetched successfully",
    };
  } catch (error) {
    console.error("Error in getOrders service:", error);
    throw new Error(`Failed to fetch orders: ${error.message || error}`);
  }
}

export const OrderService = {
  getOrders,
};
