import { Op, fn, col, literal } from "sequelize";
import axios from "axios";

import User from "../models/user.model.js";
import Order from "../models/order.model.js";
import Trade from "../models/trade.model.js";
import UserSubscription from "../models/user_subscription.model.js";
import TradeAccount from "../models/trade_account.model.js";
import Plan from "../models/plan.model.js";

import config from "../config/env.js";

/* ======================================================
   TRADESYNC CLIENT
====================================================== */

const tradesyncAuth = {
  username: config.trade_sync.key,
  password: config.trade_sync.secret,
};

/* ======================================================
   DATE UTILITIES
====================================================== */

const startOfDayUTC = (date) =>
  new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );

const endOfDayUTC = (date) =>
  new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );

const buildRange = (rangeType, q = {}) => {
  const now = new Date();
  const type = rangeType || "1w";

  let startUTC;
  let endUTC;

  switch (type) {
    case "today":
      startUTC = startOfDayUTC(now);
      endUTC = endOfDayUTC(now);
      break;

    case "1m":
      const mStart = new Date(now);
      mStart.setUTCDate(now.getUTCDate() - 29);
      startUTC = startOfDayUTC(mStart);
      endUTC = endOfDayUTC(now);
      break;

    case "range":
      startUTC = startOfDayUTC(new Date(q.start));
      endUTC = endOfDayUTC(new Date(q.end));
      break;

    case "1w":
    default:
      const wStart = new Date(now);
      wStart.setUTCDate(now.getUTCDate() - 6);
      startUTC = startOfDayUTC(wStart);
      endUTC = endOfDayUTC(now);
      break;
  }

  return { startUTC, endUTC };
};

/* ======================================================
   PLAN CAPABILITIES
====================================================== */

const PLAN_CAPABILITIES = {
  FREE: { advancedMetrics: false, switchAccount: false, dashboard: "basic" },
  STANDARD: {
    advancedMetrics: true,
    switchAccount: true,
    dashboard: "advance",
  },
  ELITE: { advancedMetrics: true, switchAccount: true, dashboard: "advance" },
};

const resolvePlan = (user) => {
  const activeSub =
    user.subscriptions.status === "active" ? user.subscriptions : null;
  const planName = activeSub?.plan?.code?.toUpperCase() || "FREE";
  const caps = PLAN_CAPABILITIES[planName] || PLAN_CAPABILITIES.FREE;
  return { planName, caps };
};

/* ======================================================
   STRATEGY BASE
====================================================== */

class DashboardStrategy {
  async execute() {
    throw new Error("Strategy must implement execute()");
  }
}

/* ======================================================
   FREE STRATEGY (DB)
====================================================== */
class FreeDashboardStrategy extends DashboardStrategy {
  constructor(user, q, planName, caps) {
    super();
    this.user = user;
    this.q = q;
    this.planName = planName;
    this.caps = caps;
  }

  async execute() {
    try {
      const accountIds = this.user.tradeAccounts?.map((a) => a.id) || [];

      if (!accountIds.length) {
        return this.emptyResponse(false);
      }

      const hasRange = !!this.q.range;

      /* ======================================================
       TOTALS (ALL TIME UNLESS RANGE PROVIDED)
    ====================================================== */

      const totalsWhere = {
        accountId: { [Op.in]: accountIds },
      };

      if (hasRange) {
        const { startUTC, endUTC } = buildRange(this.q.range, this.q);

        totalsWhere.closeDate = {
          [Op.gte]: startUTC,
          [Op.lte]: endUTC,
        };
      }

      const { rows: totalTradesRows = [], count = 0 } =
        await Trade.findAndCountAll({
          where: totalsWhere,
        });

      /* ======================================================
       CHART RANGE
       - If range exists → use it
       - Otherwise → default 1 week
    ====================================================== */

      const { startUTC, endUTC } = hasRange
        ? buildRange(this.q.range, this.q)
        : buildRange("1w");

      const chartWhere = {
        accountId: { [Op.in]: accountIds },
        closeDate: {
          [Op.gte]: startUTC,
          [Op.lte]: endUTC,
        },
      };

      const chartTrades = await Trade.findAll({
        where: chartWhere,
        order: [["closeDate", "ASC"]],
      });

      /* ======================================================
       CALCULATIONS (TOTALS BASED ON totalsWhere)
    ====================================================== */

      let totalProfit = 0;
      let grossProfit = 0;
      let grossLoss = 0;
      let wins = 0;
      let riskRewardSum = 0;

      const symbolMap = Object.create(null);
      const dayMap = Object.create(null);

      for (const trade of totalTradesRows) {
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

        symbolMap[symbol] = symbolMap[symbol] || {
          profit: 0,
          count: 0,
        };

        symbolMap[symbol].profit += profit;
        symbolMap[symbol].count += 1;
      }

      /* ======================================================
       BUILD AREA CHART (BASED ON chartTrades)
    ====================================================== */

      for (const trade of chartTrades) {
        const profit = Number(trade.profit ?? 0);
        const closeDate = trade.closeDate ? new Date(trade.closeDate) : null;

        if (!closeDate) continue;

        const label = closeDate.toISOString().slice(0, 10);

        if (!dayMap[label]) {
          dayMap[label] = {
            profit: 0,
            loss: 0,
            count: 0,
          };
        }

        if (profit > 0) {
          dayMap[label].profit += profit;
        } else {
          dayMap[label].loss += Math.abs(profit);
        }

        dayMap[label].count += 1;
      }

      const safeCount = Number(count) || totalTradesRows.length;

      const winRate = safeCount ? (wins / safeCount) * 100 : 0;
      const profitFactor =
        grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;

      const avgRiskReward = safeCount ? riskRewardSum / safeCount : 0;

      const avgProfitPerTrade = safeCount ? totalProfit / safeCount : 0;

      const mostTradedPair = Object.keys(symbolMap).length
        ? Object.entries(symbolMap).reduce((a, b) =>
            b[1].count > a[1].count ? b : a,
          )[0]
        : "N/A";

      const profitDistribution = Object.entries(symbolMap).map(
        ([label, values]) => ({
          label,
          profit: +values.profit.toFixed(2),
          count: values.count,
        }),
      );

      const plAreaChart = Object.entries(dayMap).map(([label, values]) => ({
        label,
        profit: +values.profit.toFixed(2),
        loss: +values.loss.toFixed(2),
        count: values.count,
      }));

      return {
        mode: "user",
        plan: this.planName,

        totals: {
          totalTrades: safeCount,
          winRate: +winRate.toFixed(2),
          profitFactor: +profitFactor.toFixed(2),
          riskRewardRatio: +avgRiskReward.toFixed(2),
          mostTradedPair,
          totalProfit: +grossProfit.toFixed(2),
          totalLoss: +grossLoss.toFixed(2),
          totalNetProfit: +(grossProfit - grossLoss).toFixed(2),
          profitLossRatio: grossLoss
            ? +(grossProfit / grossLoss).toFixed(2)
            : 0,
          avgProfitPerTrade: +avgProfitPerTrade.toFixed(2),
        },

        charts: {
          profitDistribution,
          plAreaChart,
        },

        trades: chartTrades.slice(0, 10),

        range: {
          start: startUTC,
          end: endUTC,
        },

        has_trade_account: true,
        can_switch_account: this.caps.switchAccount,
      };
    } catch (error) {
      console.error("Free dashboard error:", error.message);
      return this.emptyResponse(true);
    }
  }

  emptyResponse(hasAccount, startUTC = null, endUTC = null) {
    return {
      mode: "user",
      plan: this.planName,
      totals: {
        totalTrades: 0,
        totalTradesPastWeek: 0,
        totalTradesCurrentMonth: 0,
        winRate: 0,
        profitFactor: 0,
        riskRewardRatio: 0,
        mostTradedPair: "N/A",
        totalProfit: 0,
        totalLoss: 0,
        totalNetProfit: 0,
        profitLossRatio: 0,
        avgProfitPerTrade: 0,
      },
      charts: {
        profitDistribution: [],
        plAreaChart: [],
      },
      trades: [],
      range: {
        start: startUTC,
        end: endUTC,
      },
      has_trade_account: hasAccount,
      can_switch_account: this.caps.switchAccount,
    };
  }
}
/* ======================================================
   TRADESYNC STRATEGY
====================================================== */

class TradeSyncDashboardStrategy extends DashboardStrategy {
  constructor(account, q, planName, caps) {
    super();
    this.account = account;
    this.q = q;
    this.planName = planName;
    this.caps = caps;
  }

  async execute() {
    const hasRange = !!this.q.range;

    /* =========================================
       FETCH ALL TRADES (PAGINATED)
    ========================================= */

    const LIMIT = 1000;
    let lastId = null;
    let hasMore = true;
    let allTrades = [];

    while (hasMore) {
      const url = new URL("https://api.tradesync.com/trades");

      url.searchParams.append("account_id", this.account.tradesyncId);
      url.searchParams.append("limit", LIMIT);
      url.searchParams.append("order", "desc");

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

    /* =========================================
       FILTER CLOSED TRADES
    ========================================= */

    const closedTrades = allTrades.filter(
      (t) => t.state === "closed" && t.close_time,
    );

    /* =========================================
       TOTALS (LIFETIME OR RANGE)
    ========================================= */

    let totalsTrades = closedTrades;

    if (hasRange) {
      const { startUTC, endUTC } = buildRange(this.q.range, this.q);

      totalsTrades = closedTrades.filter((t) => {
        const close = new Date(t.close_time);
        return close >= startUTC && close <= endUTC;
      });
    }

    const totalTrades = totalsTrades.length;
    const netProfit = totalsTrades.reduce(
      (sum, t) => sum + (Number(t.profit) || 0),
      0,
    );

    /* =========================================
       CHART RANGE (DEFAULT 1W)
    ========================================= */

    const { startUTC, endUTC } = hasRange
      ? buildRange(this.q.range, this.q)
      : buildRange("1w");

    const chartTrades = closedTrades.filter((t) => {
      const close = new Date(t.close_time);
      return close >= startUTC && close <= endUTC;
    });

    /* =========================================
       PROFIT DISTRIBUTION
    ========================================= */

    const symbolMap = {};

    for (const t of totalsTrades) {
      const symbol = t.symbol || "Unknown";

      if (!symbolMap[symbol]) {
        symbolMap[symbol] = { profit: 0, count: 0 };
      }

      symbolMap[symbol].profit += Number(t.profit) || 0;
      symbolMap[symbol].count += 1;
    }

    const profitDistribution = Object.entries(symbolMap).map(
      ([label, values]) => ({
        label,
        profit: +values.profit.toFixed(2),
        count: values.count,
      }),
    );

    /* =========================================
       AREA CHART (VISUAL ONLY)
    ========================================= */

    const dayMap = {};

    for (const t of chartTrades) {
      const profit = Number(t.profit ?? 0);
      const label = new Date(t.close_time).toISOString().slice(0, 10);

      if (!dayMap[label]) {
        dayMap[label] = { profit: 0, loss: 0, count: 0 };
      }

      if (profit > 0) dayMap[label].profit += profit;
      else dayMap[label].loss += Math.abs(profit);

      dayMap[label].count += 1;
    }

    const plAreaChart = Object.entries(dayMap).map(([label, values]) => ({
      label,
      profit: +values.profit.toFixed(2),
      loss: +values.loss.toFixed(2),
      count: values.count,
    }));

    /* =========================================
       FETCH ANALYSES
    ========================================= */

    const analyses = await this.fetchAnalyses(startUTC, endUTC);

    return {
      mode: "user",
      plan: this.planName,

      totals: {
        totalTrades,
        netProfit: +netProfit.toFixed(2),
      },

      charts: {
        profitDistribution,
        plAreaChart,
      },

      insights: this.buildInsights(analyses),

      trades: chartTrades.slice(0, 10),

      range: {
        start: startUTC,
        end: endUTC,
      },

      has_trade_account: true,
      can_switch_account: this.caps.switchAccount,
    };
  }

  /* =========================================
     INSIGHTS ENGINE
  ========================================= */

  buildInsights(analyses) {
    const { monthlies = [], dailies = [] } = analyses;

    if (!monthlies.length && !dailies.length) {
      return {
        trend: "neutral",
        performanceSignal: "neutral",
        message: "No data available",
      };
    }

    /* ===== PROFIT TREND ===== */

    let profitTrend = "neutral";

    if (monthlies.length >= 2) {
      const last = monthlies[monthlies.length - 1].profit;
      const prev = monthlies[monthlies.length - 2].profit;

      if (last > prev) profitTrend = "trend_up";
      else if (last < prev) profitTrend = "trend_down";
    }

    /* ===== TRADE VOLUME TREND ===== */

    let tradeTrend = "neutral";

    if (monthlies.length >= 2) {
      const last = monthlies[monthlies.length - 1].trades;
      const prev = monthlies[monthlies.length - 2].trades;

      if (last > prev) tradeTrend = "trend_up";
      else if (last < prev) tradeTrend = "trend_down";
    }

    /* ===== MOMENTUM (LAST 7 DAYS) ===== */

    const last7 = dailies.slice(-7);
    const positiveDays = last7.filter((d) => d.profit > 0).length;
    const winMomentum =
      last7.length > 0 ? (positiveDays / last7.length) * 100 : 0;

    /* ===== PERFORMANCE SIGNAL ===== */

    let performanceSignal = "neutral";

    if (profitTrend === "trend_up" && tradeTrend === "trend_up") {
      performanceSignal = "strong_bullish";
    } else if (profitTrend === "trend_down" && tradeTrend === "trend_down") {
      performanceSignal = "strong_bearish";
    } else if (profitTrend === "trend_up") {
      performanceSignal = "improving";
    } else if (profitTrend === "trend_down") {
      performanceSignal = "weakening";
    }

    return {
      profitTrend,
      tradeTrend,
      performanceSignal,
      winMomentum: +winMomentum.toFixed(2),
      monthsAnalyzed: monthlies.length,
      daysAnalyzed: dailies.length,
      summary: analyses.summary,
    };
  }

  /* =========================================
     ANALYSES FETCHER
  ========================================= */

  async fetchAnalyses(startUTC, endUTC) {
    const baseURL =
      process.env.TRADESYNC_API_URL || "https://api.tradesync.com/analyses";

    try {
      const [monthliesRes, dailiesRes] = await Promise.all([
        axios.get(
          `${baseURL}/${this.account.tradesyncId}/monthlies?page=1&limit=24`,
          { auth: tradesyncAuth },
        ),
        axios.get(
          `${baseURL}/${this.account.tradesyncId}/dailies?page=1&limit=90`,
          { auth: tradesyncAuth },
        ),
      ]);

      const rawMonthlies = monthliesRes.data?.data || [];
      const rawDailies = dailiesRes.data?.data || [];

      const monthlies = rawMonthlies
        .filter((m) => {
          const date = new Date(m.date || m.month);
          return date >= startUTC && date <= endUTC;
        })
        .map((m) => ({
          date: m.date || m.month,
          profit: +Number(m.profit || 0).toFixed(2),
          trades: Number(m.trades || 0),
          winRate: +Number(m.win_rate || 0).toFixed(2),
        }));

      const dailies = rawDailies
        .filter((d) => {
          const date = new Date(d.date);
          return date >= startUTC && date <= endUTC;
        })
        .map((d) => ({
          date: d.date,
          profit: +Number(d.profit || 0).toFixed(2),
          trades: Number(d.trades || 0),
          winRate: +Number(d.win_rate || 0).toFixed(2),
        }));

      return { monthlies, dailies };
    } catch (error) {
      console.error("TradeSync analyses error:", error.message);
      return { monthlies: [], dailies: [] };
    }
  }
}

/* ======================================================
   ADMIN STRATEGY
====================================================== */

class AdminDashboardStrategy extends DashboardStrategy {
  async execute() {
    const [totalUsers, totalTrades, totalOrders, totalActiveSubscriptions] =
      await Promise.all([
        User.count(),
        Trade.count(),
        Order.count(),
        UserSubscription.count({ where: { status: "active" } }),
      ]);

    return {
      mode: "admin",
      totals: {
        totalUsers,
        totalTrades,
        totalOrders,
        totalActiveSubscriptions,
      },
    };
  }
}

/* ======================================================
   STRATEGY RESOLVER
====================================================== */

class DashboardContext {
  static resolveStrategy(user, q) {
    const role = String(user.role || "").toLowerCase();

    if (role.includes("admin")) {
      return new AdminDashboardStrategy();
    }

    const { planName, caps } = resolvePlan(user);
    const account = user.tradeAccounts?.[0] || null;

    if (
      caps.dashboard === "advance" &&
      account?.tradesyncId &&
      ["MT4", "MT5"].includes(account.type)
    ) {
      return new TradeSyncDashboardStrategy(account, q, planName, caps);
    }

    return new FreeDashboardStrategy(user, q, planName, caps);
  }
}

/* ======================================================
   ENTRY POINT
====================================================== */

const getDashboard = async (q) => {
  const { user_id } = q;

  if (!user_id) {
    return {
      success: false,
      code: 400,
      message: "user-id-required",
      data: null,
    };
  }

  const user = await User.findByPk(user_id, {
    include: [
      {
        model: TradeAccount,
        as: "tradeAccounts",
        where: { isActive: true },
        required: false,
      },
      {
        model: UserSubscription,
        as: "subscriptions",
        include: [{ model: Plan, as: "plan", attributes: ["code"] }],
      },
    ],
  });

  if (!user) {
    return { success: false, code: 404, message: "user-not-found", data: null };
  }

  const strategy = DashboardContext.resolveStrategy(user, q);
  const result = await strategy.execute();

  return {
    success: true,
    code: 200,
    message: "dashboard-found",
    data: result,
  };
};

export const dashboardService = { getDashboard };
