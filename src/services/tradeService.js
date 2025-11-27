import Trade from "../models/trade.model.js";
import { Op } from "sequelize";
import TradeAccount from "../models/trade_account.model.js";
import User from "../models/user.model.js";
import axios from "axios";
import config from "../config/env.js";

function applyTradeFilters(trades, { selectedDate, month }) {
  const now = new Date();

  // Helper
  const getDate = (t) => new Date(t.open_time || t.close_time);

  // ---------------------------
  // 🔹 1. selectedDate (exact day)
  // ---------------------------
  if (selectedDate) {
    const start = new Date(selectedDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);

    return trades.filter((t) => {
      const d = getDate(t);
      return d >= start && d < end;
    });
  }

  // ---------------------------
  // 🔹 2. month = "3m"
  // ---------------------------
  if (month === "3m") {
    const past = new Date();
    past.setMonth(now.getMonth() - 3);

    return trades.filter((t) => {
      const d = getDate(t);
      return d >= past && d <= now;
    });
  }

  // ---------------------------
  // 🔹 3. month = "6m"
  // ---------------------------
  if (month === "6m") {
    const past = new Date();
    past.setMonth(now.getMonth() - 6);

    return trades.filter((t) => {
      const d = getDate(t);
      return d >= past && d <= now;
    });
  }

  // ---------------------------
  // 🔹 4. month = "current_month"
  // ---------------------------
  if (month === "current_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    return trades.filter((t) => {
      const d = getDate(t);
      return d >= start && d < end;
    });
  }

  // No filters selected
  return trades;
}

export async function createTrade(tradeDetails) {
  try {
    const trade = await Trade.create(tradeDetails);
    if (!trade) {
      throw new Error("Trade not created");
    }
    return {
      code: 201,
      message: "Trade created successfully",
      data: trade,
      success: true,
    };
  } catch (error) {
    console.error("Error in createTrade service:", error);
    throw new Error(`Failed to create trade: ${error}`);
  }
}

export async function getTrades(query = {}) {
  console.log(query);

  try {
    const {
      page = 0,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "DESC",

      // filters
      id,
      type,
      status,
      accountId,
      selectedDate,
      month,
      symbol,
      lots,
      minLots,
      maxLots,
      openDate,
      openDateFrom,
      openDateTo,
      closeDate,
      closeDateFrom,
      closeDateTo,
      range,
    } = query;

    // 🔹 Step 1: Try to get trade account + user
    let tradeAcc = null;
    let user = null;

    if (accountId) {
      tradeAcc = await TradeAccount.findByPk(accountId, {
        include: [{ model: User, as: "user" }],
      });
      user = tradeAcc?.user;
    }

    const isMTType = ["MT4", "MT5"].includes(tradeAcc?.type);
    const isPaidUser = true;

    // 🟢 Step 2: If paid user + MT4/MT5 → use TradeSync API instead of local DB
    if (isPaidUser && isMTType && tradeAcc?.tradesyncId) {
      const pageNum = Math.max(parseInt(page, 10) || 1, 1);
      const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

      const tradesyncAuth = {
        username: config.trade_sync.key,
        password: config.trade_sync.secret,
      };

      try {
        // Fetch ALL trades
        const allTradesResp = await axios.get(
          `https://api.tradesync.com/trades?account_id=${tradeAcc.tradesyncId}`,
          { auth: tradesyncAuth }
        );

        let allTrades = allTradesResp?.data?.data || [];

        // 🟢 APPLY FILTERS HERE
        allTrades = applyTradeFilters(allTrades, { selectedDate, month });

        const total = allTrades.length;

        // Manual pagination
        const startIndex = (pageNum - 1) * limitNum;
        const paginatedTrades = allTrades.slice(
          startIndex,
          startIndex + limitNum
        );

        const totalPages = Math.ceil(total / limitNum);

        return {
          code: 200,
          success: true,
          message:
            "Trades fetched from TradeSync successfully (filtered + paginated)",
          sync: true,
          data: paginatedTrades,
          pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages,
          },
        };
      } catch (apiError) {
        console.error(
          "TradeSync API error:",
          apiError.response?.data || apiError.message
        );
        throw new Error(
          `Failed to fetch trades from TradeSync: ${
            apiError.response?.data?.message || apiError.message
          }`
        );
      }
    }
    // 🟡 Step 3: Local DB fallback (FREE plan or non-MT4/MT5)
    const whereClause = {};

    if (id) whereClause.id = id;
    if (type) whereClause.type = type;
    if (status) whereClause.status = status;
    if (accountId) whereClause.accountId = accountId;
    if (symbol) whereClause.symbol = symbol;
    if (selectedDate) whereClause.openDate = selectedDate;
    if (month) whereClause.openDate = month;
    if (range) whereClause.openDate = range;

    if (selectedDate) {
      const start = new Date(selectedDate);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);

      whereClause.openDate = {
        [Op.between]: [start, end],
      };
    }

    /* -------------------------------------------
   ✅ MONTH FILTER (YYYY-MM) → Full month range
------------------------------------------- */
    // ✅ DAY FILTER (YYYY-MM-DD)
    if (selectedDate) {
      const start = new Date(selectedDate);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);

      whereClause.openDate = {
        [Op.between]: [start, end],
      };
    }

    // ✅ MONTH FILTER (YYYY-MM)
    if (month && isValidYM(month)) {
      const [year, monthNum] = month.split("-").map(Number);

      const startOfMonth = new Date(year, monthNum - 1, 1);
      const endOfMonth = new Date(year, monthNum, 1); // first day of next month

      whereClause.openDate = {
        [Op.gte]: startOfMonth,
        [Op.lt]: endOfMonth,
      };
    }

    // ✅ RANGE FILTER (current, 3m, 6m)
    if (range) {
      const now = new Date();
      let start = null;

      if (range === "current") {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (range === "3m") {
        start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      } else if (range === "6m") {
        start = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      }

      if (start) {
        whereClause.openDate = {
          [Op.gte]: start,
          [Op.lt]: now,
        };
      }
    }

    // lots exact or range
    if (lots !== undefined && lots !== null && lots !== "") {
      whereClause.lots = Number(lots);
    } else if (minLots || maxLots) {
      whereClause.lots = {};
      if (minLots) whereClause.lots[Op.gte] = Number(minLots);
      if (maxLots) whereClause.lots[Op.lte] = Number(maxLots);
    }

    // openDate filters
    if (openDateFrom || openDateTo) {
      whereClause.openDate = {};
      if (openDateFrom) whereClause.openDate[Op.gte] = new Date(openDateFrom);
      if (openDateTo) whereClause.openDate[Op.lte] = new Date(openDateTo);
    } else if (openDate) {
      const start = new Date(openDate);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      whereClause.openDate = { [Op.between]: [start, end] };
    }

    // closeDate filters
    if (closeDateFrom || closeDateTo) {
      whereClause.closeDate = {};
      if (closeDateFrom)
        whereClause.closeDate[Op.gte] = new Date(closeDateFrom);
      if (closeDateTo) whereClause.closeDate[Op.lte] = new Date(closeDateTo);
    } else if (closeDate) {
      const start = new Date(closeDate);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      whereClause.closeDate = { [Op.between]: [start, end] };
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const offset = (pageNum - 1) * limitNum;
    const order = [
      [sortBy, String(sortOrder).toUpperCase() === "ASC" ? "ASC" : "DESC"],
    ];

    const { rows, count } = await Trade.findAndCountAll({
      where: whereClause,
      offset,
      limit: limitNum,
      order,
    });

    return {
      code: 200,
      success: true,
      message: "Trades fetched from local DB successfully",
      source: "local",
      data: rows,
      sync: false,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum) || 1,
      },
    };
  } catch (error) {
    console.error("Error in getTrades service:", error);
    throw new Error(`Failed to fetch trades: ${error.message}`);
  }
}

export async function updateTrade(body) {
  try {
    if (!body.id) {
      return {
        code: 400,
        message: "Trade ID is required",
        success: false,
      };
    }
    const trade = await Trade.update(body, {
      where: { id: body.id },
      returning: true,
    });
    return {
      code: 200,
      message: "Trade updated successfully",
      success: true,
      data: trade,
    };
  } catch (error) {
    console.error("Error in updateTrade service:", error);
    throw new Error(`Failed to update trade: ${error}`);
  }
}

export async function deleteTrade(id) {
  console.log(id);
  try {
    if (!id) {
      return {
        code: 400,
        message: "Trade ID is required",
        success: false,
      };
    }
    const trade = await Trade.destroy({
      where: { id: id },
    });
    return {
      code: 200,
      message: "Trade deleted successfully",
      success: true,
      data: trade,
    };
  } catch (error) {
    console.error("Error in deleteTrade service:", error);
    throw new Error(`Failed to delete trade: ${error}`);
  }
}

export async function bulkDeleteTrade(body) {
  try {
    if (!body.ids) {
      return {
        code: 400,
        message: "Trade IDs are required",
        success: false,
      };
    }
    const trades = await Trade.destroy({
      where: { id: body.ids },
    });
    return {
      code: 200,
      message: "Trades deleted successfully",
      success: true,
      data: trades,
    };
  } catch (error) {
    console.error("Error in bulkDeleteTrade service:", error);
    throw new Error(`Failed to delete trades: ${error}`);
  }
}

export async function bulkCreateTrade(body) {
  try {
    if (!body) {
      return {
        code: 400,
        message: "Trades are required",
        success: false,
      };
    }
    const trades = await Trade.bulkCreate(body);
    return {
      code: 200,
      message: "Trades bulk created successfully",
      success: true,
      data: trades,
    };
  } catch (error) {
    console.error("Error in bulkCreateTrade service:", error);
    throw new Error(`Failed to create trades: ${error}`);
  }
}

export const tradeService = {
  createTrade,
  getTrades,
  updateTrade,
  deleteTrade,
  bulkDeleteTrade,
  bulkCreateTrade,
};
