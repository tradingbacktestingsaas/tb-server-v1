import dayjs from "dayjs";
import Trade from "../models/trade.model.js";
import TradeAccount from "../models/trade_account.model.js";
import User from "../models/user.model.js";
import { Op } from "sequelize";
import axios from "axios";
import config from "../config/env.js";

const tradeSyncGet = (path) =>
  axios.get(`${config.trade_sync.url.replace(/\/+$/, "")}${path}`, {
    auth: {
      username: config.trade_sync.key,
      password: config.trade_sync.secret,
    },
    timeout: 8000,
  });

export async function getStats(tradeAccountId) {
  try {
    // 1️⃣ Find trade account with user info
    const currentAcc = await TradeAccount.findByPk(tradeAccountId, {
      include: [{ model: User, as: "user" }],
    });

    if (!currentAcc) {
      return {
        message: "Trade account not found",
        success: true,
        data: getEmptyStats(),
      };
    }

    const isMTType = ["MT4", "MT5"].includes(currentAcc.type);
    const isPaidUser = true;
    // 2️⃣ If MT4/MT5 and paid plan — fetch from TradeSync
    if (isMTType && isPaidUser && currentAcc.tradesyncId) {
      try {
        const auth = {
          username: config.trade_sync.key,
          password: config.trade_sync.secret,
        };

        const response = await axios.get(
          `https://api.tradesync.com/analyses/${currentAcc.tradesyncId}`,
          { auth }
        );

        if (response.data?.data) {
          return {
            message: "TradeSync analytics fetched successfully",
            success: true,
            data: response.data.data,
          };
        }

        return {
          message: "No analytics data available from TradeSync",
          success: true,
          data: getEmptyStats(),
        };
      } catch (err) {
        console.error("⚠️ Error fetching TradeSync analytics:", err.message);
        // fallback to local stats
      }
    }

    // 3️⃣ Otherwise, compute locally
    const { rows: trades, count: totalTrades } = await Trade.findAndCountAll({
      where: { accountId: tradeAccountId },
    });

    if (!trades || trades.length === 0) {
      return {
        message: "No trades exist for this account",
        success: true,
        data: getEmptyStats(),
      };
    }

    const now = dayjs();
    const weekAgo = now.subtract(7, "day").valueOf();
    const startOfMonth = now.startOf("month").valueOf();

    let totalProfit = 0;
    let wins = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let riskRewardSum = 0;
    let tradesPastWeek = 0;
    let tradesCurrentMonth = 0;
    const mostTradedCount = Object.create(null);

    for (const trade of trades) {
      const ts =
        (trade.openDate ? new Date(trade.openDate).getTime() : null) ??
        (trade.createdAt ? new Date(trade.createdAt).getTime() : null) ??
        0;

      const profit = Number(trade.profit ?? 0);
      const symbol = String(trade.symbol ?? "Unknown");

      totalProfit += profit;

      if (profit > 0) {
        wins++;
        grossProfit += profit;
      } else if (profit < 0) {
        grossLoss += Math.abs(profit);
      }

      const openPrice = Number(trade.openPrice ?? 0);
      const closePrice = Number(trade.closePrice ?? 0);
      const risk = Math.abs(openPrice - closePrice);
      if (risk > 0) {
        riskRewardSum += Math.abs(profit) / risk;
      }

      mostTradedCount[symbol] = (mostTradedCount[symbol] || 0) + 1;

      if (ts > weekAgo) tradesPastWeek++;
      if (ts > startOfMonth) tradesCurrentMonth++;
    }

    const count = Number(totalTrades) || trades.length;
    const winRate = count ? (wins / count) * 100 : 0;
    const profitFactor = grossLoss
      ? grossProfit / grossLoss
      : grossProfit
      ? Infinity
      : 0;
    const avgRiskReward = count ? riskRewardSum / count : 0;
    const avgProfitPerTrade = count ? totalProfit / count : 0;

    const mostTradedPair = Object.keys(mostTradedCount).length
      ? Object.entries(mostTradedCount).reduce((a, b) =>
          b[1] > a[1] ? b : a
        )[0]
      : "N/A";

    return {
      message: "Local stats calculated successfully",
      success: true,
      data: {
        totalTrades: count,
        totalTradesPastWeek: tradesPastWeek,
        totalTradesCurrentMonth: tradesCurrentMonth,
        winRate: +winRate.toFixed(2),
        profitFactor: Number.isFinite(profitFactor)
          ? +profitFactor.toFixed(2)
          : Infinity,
        riskRewardRatio: +avgRiskReward.toFixed(2),
        mostTradedPair,
        totalProfit: +grossProfit.toFixed(2),
        totalLoss: +grossLoss.toFixed(2),
        totalNetProfit: +(grossProfit - grossLoss).toFixed(2),
        profitLossRatio: +(grossLoss ? grossProfit / grossLoss : 0).toFixed(2),
        avgProfitPerTrade: +avgProfitPerTrade.toFixed(2),
      },
    };
  } catch (error) {
    console.error("Error in getStats service:", error);
    throw new Error(`Failed to fetch stats: ${error.message}`);
  }
}

export async function getFullAnalyses(req) {
  const q = req.query || req;

  const accountId = q.accountId || q.account_id;
  if (!accountId) throw new Error("accountId is required");

  // Helper: read page value
  const readPage = (group, defaultPage) => {
    const dotted = q[`${group}.page`];
    if (dotted) return parseInt(dotted, 10) || defaultPage;
    if (q[group] && typeof q[group] === "object" && q[group].page) {
      return parseInt(q[group].page, 10) || defaultPage;
    }
    const flatKey =
      group === "monthlies"
        ? q.monthPage || q.month_page
        : q.dailyPage || q.daily_page;
    if (flatKey) return parseInt(flatKey, 10) || defaultPage;
    return defaultPage;
  };

  // Helper: read limit value
  const readLimit = (group, defaultLimit) => {
    const dotted = q[`${group}.limit`];
    if (dotted) return parseInt(dotted, 10) || defaultLimit;
    if (q[group] && typeof q[group] === "object" && q[group].limit) {
      return parseInt(q[group].limit, 10) || defaultLimit;
    }
    const flatKey =
      group === "monthlies"
        ? q.monthLimit || q.month_limit
        : q.dailyLimit || q.daily_limit;
    if (flatKey) return parseInt(flatKey, 10) || defaultLimit;
    return defaultLimit;
  };

  // 🕒 Separate Range Handling
  const monthRange = q.monthRange || "90d"; // e.g. "3m" or "90d"
  const dailyRange = q.dailyRange || "30d";

  const normalizeRangeToLimit = (range, defaults) => {
    if (!range) return defaults;
    switch (range) {
      case "7d":
        return 7;
      case "30d":
        return 30;
      case "90d":
        return 90;
      case "3m":
        return 3;
      case "6m":
        return 6;
      default:
        if (!isNaN(Number(range))) return Number(range);
        return defaults;
    }
  };

  // 📆 Compute pages & limits separately
  const monthlies = {
    page: readPage("monthlies", 1),
    limit: normalizeRangeToLimit(monthRange, 12), // months
  };

  const dailies = {
    page: readPage("dailies", 1),
    limit: normalizeRangeToLimit(dailyRange, 30), // days
  };

  // 🔒 Account validation
  const tradeAcc = await TradeAccount.findByPk(accountId, {
    include: [{ model: User, as: "user" }],
  });

  if (!tradeAcc)
    return { success: false, message: "Trade account not found", data: null };

  const isEligible =
    (tradeAcc.type === "MT4" || tradeAcc.type === "MT5") &&
    tradeAcc.user?.plan !== "FREE";
  if (!isEligible)
    return {
      success: false,
      message:
        "Analyses are only available for MT4/MT5 accounts with a paid plan.",
      data: null,
    };

  if (!tradeAcc.tradesyncId)
    return {
      success: false,
      message: "TradeSync ID not linked to this account.",
      data: null,
    };

  const auth = {
    username: config.trade_sync.key,
    password: config.trade_sync.secret,
  };

  const baseURL =
    process.env.TRADESYNC_API_URL || "https://api.tradesync.com/analyses";

  try {
    // 🧠 Fetch monthlies & dailies separately with their own limits
    const [monthliesRes, dailiesRes] = await Promise.all([
      axios.get(
        `${baseURL}/${tradeAcc.tradesyncId}/monthlies?page=${monthlies.page}&limit=${monthlies.limit}`,
        { auth }
      ),
      axios.get(
        `${baseURL}/${tradeAcc.tradesyncId}/dailies?page=${dailies.page}&limit=${dailies.limit}`,
        { auth }
      ),
    ]);

    return {
      success: true,
      message: "TradeSync full analyses fetched successfully",
      data: {
        monthlies: {
          data: monthliesRes.data?.data ?? [],
          meta: {
            ...(monthliesRes.data?.meta || {}),
            ...monthlies,
            range: monthRange,
          },
        },
        dailies: {
          data: dailiesRes.data?.data ?? [],
          meta: {
            ...(dailiesRes.data?.meta || {}),
            ...dailies,
            range: dailyRange,
          },
        },
      },
    };
  } catch (error) {
    console.error(
      "❌ Error fetching TradeSync analyses:",
      error.response?.data || error.message
    );
    return {
      success: false,
      message:
        error.response?.data?.message ||
        error.message ||
        "Failed to fetch TradeSync analyses",
      data: null,
    };
  }
}

// 4️⃣ Helper to return empty stats object
function getEmptyStats() {
  return {
    profit_loss: 0,
    growth: 0,
    total_deposits: 0,
    total_withdrawals: 0,
    total_lots: 0,
    total_commission: 0,
    total_swap: 0,
    total_trades: 0,
    total_longs: 0,
    total_shorts: 0,
    total_trades_won: 0,
    total_trades_lost: 0,
    average_win: 0,
    average_loss: 0,
    best_trade: 0,
    best_trade_date: null,
    worst_trade: 0,
    worst_trade_date: null,
    longs_won: 0,
    shorts_won: 0,
  };
}

export async function podium() {
  try {
    // 1️⃣ Get eligible trade accounts (MT4 / MT5 only, users not FREE)
    const tradeAccounts = await TradeAccount.findAll({
      where: {
        type: ["MT4", "MT5"],
      },
      include: [
        {
          model: User,
          as: "user",
          where: {
            plan: { [Op.ne]: "FREE" },
          },
        },
      ],
    });

    if (!tradeAccounts.length) {
      return {
        success: true,
        data: [],
        message: "No eligible trade accounts found",
      };
    }

    // 2️⃣ Gather all TradeSync account IDs
    const accountIds = tradeAccounts
      .filter((acc) => acc.tradesyncId)
      .map((acc) => acc.tradesyncId);

    if (!accountIds.length) {
      return {
        success: false,
        data: [],
        message: "No valid TradeSync account IDs found",
      };
    }

    // 3️⃣ Fetch all trades from TradeSync in one call
    const tradesRes = await tradeSyncGet(
      `/trades?account_ids=${accountIds.join(",")}`
    );
    const trades = tradesRes?.data?.data || [];

    // 4️⃣ Group trades by account_id and calculate profit per account
    const profitByAccount = {};
    for (const trade of trades) {
      const accId = trade.account_id;
      if (!profitByAccount[accId]) profitByAccount[accId] = 0;
      profitByAccount[accId] += trade.profit || 0;
    }

    // 5️⃣ Merge with account info from DB
    const accountsWithProfit = tradeAccounts
      .map((acc) => {
        const totalProfit = profitByAccount[acc.tradesyncId] || 0;
        return {
          accountId: acc.id,
          tradesyncId: acc.tradesyncId,
          userId: acc.userId,
          username: acc.user?.firstName + acc.user?.lastName || "Unknown",
          avatar: acc.user?.avatar_url,
          totalProfit,
        };
      })
      .filter((a) => a.totalProfit !== 0);

    // 6️⃣ Sort and take top 15
    const top15 = accountsWithProfit
      .sort((a, b) => b.totalProfit - a.totalProfit)
      .slice(0, 15);

    return {
      success: true,
      data: top15,
      message: "Top 15 profitable accounts retrieved successfully",
    };
  } catch (error) {
    console.error("Error in podium:", error);
    return {
      success: false,
      message: "Failed to calculate podium",
      error: error.message,
    };
  }
}

export const analyticsService = { getStats, podium, getFullAnalyses };
