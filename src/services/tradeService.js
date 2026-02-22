import Trade from "../models/trade.model.js";
import { Op } from "sequelize";
import TradeAccount from "../models/trade_account.model.js";
import User from "../models/user.model.js";
import axios from "axios";
import config from "../config/env.js";
import UserSubscription from "../models/user_subscription.model.js";
import Plan from "../models/plan.model.js";
import createError from "http-errors";
import { getISOWeek } from "date-fns";

const normalizeSymbol = (value = "") => {
  return value
    .toString()
    .toUpperCase()
    .replace("/", "") // remove slash
    .replace(/[^A-Z0-9]/g, "") // remove non alphanumeric
    .replace(/M$/, ""); // remove trailing broker suffix like m
};

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
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "DESC",

      id,
      type,
      status,
      accountId,
      symbol,
      user_id,

      lots,
      minLots,
      maxLots,

      selectedDate,
      month,
      range,

      openDateFrom,
      openDateTo,
      closeDateFrom,
      closeDateTo,
    } = query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    /* ======================================================
       CHECK ACCOUNT + TRADESYNC ELIGIBILITY
    ====================================================== */

    let tradeAcc = null;
    if (accountId) {
      tradeAcc = await TradeAccount.findOne({
        where: { id: accountId },
        include: [
          {
            model: User,
            as: "user",
            include: [
              {
                model: UserSubscription,
                as: "subscriptions",
                include: [{ model: Plan, as: "plan", attributes: ["code"] }],
              },
            ],
          },
        ],
      });
    }

    console.log(tradeAcc, "TRADE");

    // if (user_id != tradeAcc?.user?.id) {
    //   return createError(401, "Unauthorized");
    // }

    const isMTType = ["MT4", "MT5"].includes(tradeAcc?.type);
    const isPaidUser = tradeAcc?.user?.subscriptions?.plan?.code !== "FREE"; // replace with actual plan logic

    /* ======================================================
       TRADESYNC MODE
    ====================================================== */

    if (isPaidUser && isMTType && tradeAcc?.tradesyncId) {
      const tradesyncAuth = {
        username: config.trade_sync.key,
        password: config.trade_sync.secret,
      };

      const LIMIT = 500;
      let lastId = null;
      let hasMore = true;
      let allTrades = [];

      while (hasMore) {
        const url = new URL("https://api.tradesync.com/trades");
        url.searchParams.append("account_id", tradeAcc.tradesyncId);
        url.searchParams.append("limit", LIMIT);

        if (lastId) url.searchParams.append("last_id", lastId);

        const response = await axios.get(url.toString(), {
          auth: tradesyncAuth,
        });

        const trades = response.data?.data || [];
        const meta = response.data?.meta || {};

        allTrades.push(...trades);

        if (meta?.last_id && trades.length > 0) {
          lastId = meta.last_id;
        } else {
          hasMore = false;
        }
      }

      /* ===== FILTER CLOSED ONLY ===== */

      let filtered = allTrades.filter(
        (t) => t.state === "closed" && t.close_time,
      );

      /* ===== APPLY BASIC FILTERS ===== */
      if (symbol) {
        const normalized = symbol.replace("/USD", "m");
        filtered = filtered.filter((t) => t.symbol === normalized);
      }

      /* TYPE FILTER */
      if (type) {
        filtered = filtered.filter((t) => t.type === type);
      }

      if (status) filtered = filtered.filter((t) => t.status === status);

      /* ===== DATE RANGE FILTER ===== */

      /* DATE RANGE FILTER */
      if (closeDateFrom || closeDateTo) {
        const from = closeDateFrom ? new Date(closeDateFrom) : null;
        const to = closeDateTo ? new Date(closeDateTo) : null;

        filtered = filtered.filter((t) => {
          const close = new Date(t.close_time);
          if (from && close < from) return false;
          if (to && close > to) return false;
          return true;
        });
      }

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
          filtered = filtered.filter((t) => {
            const close = new Date(t.close_time);
            return close >= start && close <= now;
          });
        }
      }

      if (sortBy) {
        filtered.sort((a, b) => {
          const aVal = a[sortBy];
          const bVal = b[sortBy];

          if (sortOrder === "ASC") {
            return aVal > bVal ? 1 : -1;
          }
          return aVal < bVal ? 1 : -1;
        });
      }

      const total = filtered.length;
      const paginated = filtered.slice(offset, offset + limitNum);

      return {
        success: true,
        source: "tradesync",
        data: paginated,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum) || 1,
        },
      };
    }

    /* ======================================================
       LOCAL DATABASE MODE
    ====================================================== */

    const where = {};

    if (id) where.id = id;
    if (type) where.type = type;
    if (status) where.status = status;
    if (accountId) where.accountId = accountId;
    if (symbol) where.symbol = symbol;

    /* ===== LOTS FILTER ===== */

    if (lots !== undefined) {
      where.lots = Number(lots);
    } else if (minLots || maxLots) {
      where.lots = {};
      if (minLots) where.lots[Op.gte] = Number(minLots);
      if (maxLots) where.lots[Op.lte] = Number(maxLots);
    }

    /* ===== DATE FILTERS ===== */

    if (selectedDate) {
      const start = new Date(selectedDate);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      where.openDate = { [Op.between]: [start, end] };
    }

    if (month) {
      const [year, monthNum] = month.split("-").map(Number);
      const start = new Date(year, monthNum - 1, 1);
      const end = new Date(year, monthNum, 1);
      where.openDate = { [Op.gte]: start, [Op.lt]: end };
    }

    if (openDateFrom || openDateTo) {
      where.openDate = {};
      if (openDateFrom) where.openDate[Op.gte] = new Date(openDateFrom);
      if (openDateTo) where.openDate[Op.lte] = new Date(openDateTo);
    }

    if (closeDateFrom || closeDateTo) {
      where.closeDate = {};
      if (closeDateFrom) where.closeDate[Op.gte] = new Date(closeDateFrom);
      if (closeDateTo) where.closeDate[Op.lte] = new Date(closeDateTo);
    }

    const order = [
      [sortBy, String(sortOrder).toUpperCase() === "ASC" ? "ASC" : "DESC"],
    ];

    const { rows, count } = await Trade.findAndCountAll({
      where,
      offset,
      limit: limitNum,
      order,
    });

    return {
      success: true,
      source: "local",
      data: rows,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum) || 1,
      },
    };
  } catch (error) {
    console.error("getTrades error:", error);
    throw new Error(`Failed to fetch trades: ${error.message}`);
  }
}

export async function getTradeJournal(query = {}) {
  try {
    const { accountId, user_id, month } = query;

    if (!accountId) throw new Error("accountId is required");
    if (!month || !/^\d{4}-\d{2}$/.test(month))
      throw new Error("month must be in YYYY-MM format");

    const [year, monthNum] = month.split("-").map(Number);

    // ✅ UTC-safe boundaries
    const startDate = new Date(Date.UTC(year, monthNum - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, monthNum, 0, 23, 59, 59, 999));

    /* ===============================
       ACCOUNT VALIDATION
    =============================== */

    const tradeAcc = await TradeAccount.findOne({
      where: { id: accountId, userId: user_id },
      include: [
        {
          model: User,
          as: "user",
          include: [
            {
              model: UserSubscription,
              as: "subscriptions",
              include: [{ model: Plan, as: "plan", attributes: ["code"] }],
            },
          ],
        },
      ],
    });

    if (!tradeAcc) throw new Error("Trade account not found");
    if (user_id && tradeAcc.user.id !== user_id)
      throw new Error("Unauthorized");

    const isMTType = ["MT4", "MT5"].includes(tradeAcc.type);
    const isPaidUser = tradeAcc?.user?.subscriptions?.plan?.code !== "FREE";

    let trades = [];

    /* ===============================
       TRADESYNC MODE
    =============================== */

    if (isPaidUser && isMTType && tradeAcc.tradesyncId) {
      const tradesyncAuth = {
        username: config.trade_sync.key,
        password: config.trade_sync.secret,
      };

      const url = new URL("https://api.tradesync.com/trades");
      url.searchParams.append("account_id", tradeAcc.tradesyncId);
      url.searchParams.append("state", "closed");

      // Some APIs ignore filtering — we still enforce later
      url.searchParams.append("from", startDate.toISOString());
      url.searchParams.append("to", endDate.toISOString());

      const response = await axios.get(url.toString(), {
        auth: tradesyncAuth,
        timeout: 10000,
      });

      const rawTrades = response.data?.data || [];

      // ✅ Enforce filtering again locally (never trust external API)
      trades = rawTrades
        .filter((t) => {
          if (!t.close_time) return false;
          const closeDate = new Date(t.close_time);
          return closeDate >= startDate && closeDate <= endDate;
        })
        .map((t) => ({
          symbol: t.symbol,
          lots: Number(t.lots) || 0,
          profit: Number(t.profit) || 0,
          closeDate: new Date(t.close_time),
        }));
    } else {
      /* ===============================
       LOCAL DATABASE MODE
    =============================== */
      const where = {
        accountId,
        closeDate: { [Op.between]: [startDate, endDate] },
      };

      if (tradeAcc?.id) where.accountId = tradeAcc.id;

      const dbTrades = await Trade.findAll({
        where,
        attributes: ["symbol", "lots", "profit", "closeDate"],
        order: [["closeDate", "ASC"]],
      });

      trades = dbTrades.map((t) => ({
        symbol: t.symbol,
        lots: Number(t.lots) || 0,
        profit: Number(t.profit) || 0,
        closeDate: new Date(t.closeDate),
      }));
    }

    /* ===============================
       GROUP BY DAY (UTC-safe)
    =============================== */

    const dayMap = new Map();

    trades.forEach((trade) => {
      const d = new Date(trade.closeDate);
      const utcKey = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
      )
        .toISOString()
        .split("T")[0];

      if (!dayMap.has(utcKey)) {
        dayMap.set(utcKey, {
          date: utcKey,
          totalProfit: 0,
          totalLots: 0,
          tradeCount: 0,
        });
      }

      const entry = dayMap.get(utcKey);
      entry.totalProfit += trade.profit;
      entry.totalLots += trade.lots;
      entry.tradeCount += 1;
    });

    const days = Array.from(dayMap.values());

    /* ===============================
       GROUP DAYS INTO ISO WEEKS
    =============================== */

    const weekMap = new Map();

    days.forEach((day) => {
      const weekNumber = getISOWeek(new Date(day.date));

      if (!weekMap.has(weekNumber)) {
        weekMap.set(weekNumber, {
          week: weekNumber,     
          days: [],
          weekProfit: 0,
          weekLots: 0,
          weekTrades: 0,
        });
      }

      const weekEntry = weekMap.get(weekNumber);
      weekEntry.days.push(day);
      weekEntry.weekProfit += day.totalProfit;
      weekEntry.weekLots += day.totalLots;
      weekEntry.weekTrades += day.tradeCount;
    });

    const dataByWeeks = Array.from(weekMap.values()).sort(
      (a, b) => a.week - b.week,
    );

    /* ===============================
       MONTH INSIGHTS
    =============================== */

    const totalProfit = trades.reduce((s, t) => s + t.profit, 0);
    const totalLots = trades.reduce((s, t) => s + t.lots, 0);
    const totalTrades = trades.length;

    const winningDays = days.filter((d) => d.totalProfit > 0).length;
    const losingDays = days.filter((d) => d.totalProfit < 0).length;

    const sortedDays = [...days].sort((a, b) => b.totalProfit - a.totalProfit);

    const bestDay = sortedDays[0] || null;
    const worstDay =
      sortedDays.length > 0 ? sortedDays[sortedDays.length - 1] : null;

    return {
      success: true,
      source:
        isPaidUser && isMTType && tradeAcc?.tradesyncId ? "tradesync" : "local",
      data: {
        dataByWeeks,
        currentMonthInsights: {
          totalTrades,
          totalProfit,
          totalLots,
          winningDays,
          losingDays,
          bestDay,
          worstDay,
        },
        currentMonth: {
          year,
          month: monthNum,
          startDate,
          endDate,
        },
      },
    };
  } catch (error) {
    console.error("getTradeJournal error:", error);
    throw new Error(`Failed to fetch trade journal: ${error.message}`);
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
  getTradeJournal,
  updateTrade,
  deleteTrade,
  bulkDeleteTrade,
  bulkCreateTrade,
};
