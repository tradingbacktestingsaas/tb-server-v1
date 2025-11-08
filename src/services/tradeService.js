import Trade from "../models/trade.model.js";
import { Op } from "sequelize";
import TradeAccount from "../models/trade_account.model.js";
import User from "../models/user.model.js";
import axios from "axios";
import config from "../config/env.js";

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
        // 🧩 Step 1: Fetch ALL trades (since API pagination is buggy)
        const allTradesResp = await axios.get(
          `https://api.tradesync.com/trades?account_id=${tradeAcc.tradesyncId}`,
          { auth: tradesyncAuth }
        );

        const allTrades = allTradesResp?.data?.data || [];
        const total = allTrades.length;

        // 🧩 Step 2: Manual pagination
        const startIndex = (pageNum - 1) * limitNum;
        const paginatedTrades = allTrades.slice(
          startIndex,
          startIndex + limitNum
        );

        // 🧩 Step 3: Compute total pages
        const totalPages = Math.ceil(total / limitNum);

        // 🧩 Step 4: Return same structure as before
        return {
          code: 200,
          success: true,
          message:
            "Trades fetched from TradeSync successfully (manual pagination)",
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
  console.log(id)
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
