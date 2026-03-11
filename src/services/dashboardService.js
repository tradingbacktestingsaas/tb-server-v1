import { Op, fn, col, literal } from "sequelize";
import axios from "axios";

import User from "../models/user.model.js";
import Order from "../models/order.model.js";
import Trade from "../models/trade.model.js";
import Feedback from "../models/feedback.model.js";
import BugReport from "../models/bug_report.model.js";
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

    case "7d":
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

const buildDayLabels = (startUTC, endUTC) => {
  const labels = [];
  const cursor = new Date(startUTC);

  while (cursor <= endUTC) {
    labels.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return labels;
};

const buildCountChart = (records, startUTC, endUTC) => {
  const labels = buildDayLabels(startUTC, endUTC);
  const dayCountMap = Object.create(null);

  for (const label of labels) {
    dayCountMap[label] = 0;
  }

  for (const item of records) {
    const rawDate = item?.createdAt;
    if (!rawDate) continue;

    const date = new Date(rawDate);
    if (date < startUTC || date > endUTC) continue;

    const label = date.toISOString().slice(0, 10);
    if (Object.prototype.hasOwnProperty.call(dayCountMap, label)) {
      dayCountMap[label] += 1;
    }
  }

  return labels.map((label) => ({
    label,
    count: dayCountMap[label] || 0,
  }));
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
    user?.subscriptions?.status === "active" ? user.subscriptions : null;
  const planName = activeSub?.plan?.code?.toUpperCase() || "FREE";
  const caps = PLAN_CAPABILITIES[planName] || PLAN_CAPABILITIES.FREE;
  return { planName, caps };
};

const getTradeEventDate = (trade) => {
  if (!trade) return null;
  return trade.closeDate || trade.openDate || null;
};

const getTradeSyncEventDate = (trade) => {
  if (!trade) return null;
  return (
    trade.close_time ||
    trade.closeDate ||
    trade.closed_at ||
    trade.open_time ||
    trade.openDate ||
    null
  );
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
      const allTradeAccounts = this.user.tradeAccounts || [];
      const requestedAccountId = this.q.accountId || this.q.account_id;

      const selectedAccounts = requestedAccountId
        ? allTradeAccounts.filter((a) => a.id === requestedAccountId)
        : allTradeAccounts;

      const accountIds = selectedAccounts.map((a) => a.id);
      const accountNumbers = selectedAccounts
        .map((a) => a.account_no)
        .filter(Boolean);

      if (!accountIds.length) {
        return this.emptyResponse(false);
      }

      const requestedRange = this.q.range || "1w";
      const hasCustomRange =
        requestedRange === "range" && !!this.q.start && !!this.q.end;

      /* ======================================================
       TOTALS (ALL TIME UNLESS RANGE PROVIDED)
    ====================================================== */

      const totalsWhere = {
        [Op.or]: [
          { accountId: { [Op.in]: accountIds } },
          ...(accountNumbers.length
            ? [{ accountNumber: { [Op.in]: accountNumbers } }]
            : []),
        ],
      };

      const { rows: totalTradesRows = [], count = 0 } =
        await Trade.findAndCountAll({
          where: totalsWhere,
        });

      /* ======================================================
       CHART RANGE
       - If range exists → use it
       - Otherwise → default 1 week
    ====================================================== */

      const safeRangeType = ["today", "1w", "1m", "range"].includes(
        requestedRange,
      )
        ? requestedRange
        : "1w";

      const { startUTC, endUTC } = hasCustomRange
        ? buildRange("range", this.q)
        : buildRange(safeRangeType);

      const chartWhere = {
        [Op.and]: [
          {
            [Op.or]: [
              { accountId: { [Op.in]: accountIds } },
              ...(accountNumbers.length
                ? [{ accountNumber: { [Op.in]: accountNumbers } }]
                : []),
            ],
          },
          {
            [Op.or]: [
              {
                closeDate: {
                  [Op.gte]: startUTC,
                  [Op.lte]: endUTC,
                },
              },
              {
                closeDate: null,
                openDate: {
                  [Op.gte]: startUTC,
                  [Op.lte]: endUTC,
                },
              },
            ],
          },
        ],
      };

      const chartTrades = await Trade.findAll({
        where: chartWhere,
        order: [["closeDate", "DESC"], ["openDate", "DESC"]],
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

      const chartSourceTrades = chartTrades.length
        ? chartTrades
        : totalTradesRows;

      for (const trade of chartSourceTrades) {
        const profit = Number(trade.profit ?? 0);
        const eventDateRaw = getTradeEventDate(trade);
        const closeDate = eventDateRaw ? new Date(eventDateRaw) : null;

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

      // If range has no rows, still provide latest trades preview from totals dataset.
      const tradesPreviewSource = totalTradesRows;

      const tradesPreview = [...tradesPreviewSource]
        .sort((a, b) => {
          const aDate = new Date(getTradeEventDate(a) || 0).getTime();
          const bDate = new Date(getTradeEventDate(b) || 0).getTime();
          return bDate - aDate;
        })
        .slice(0, 10);

      return {
        mode: "user",
        plan: this.planName,
        accountType: "free",

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

        trades: tradesPreview,

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
      accountType: "free",
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
    const requestedRange = this.q.range || "1w";
    const hasCustomRange =
      requestedRange === "range" && !!this.q.start && !!this.q.end;

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

    const closedTrades = allTrades.filter((t) => {
      const state = String(t.state || t.status || "").toLowerCase();
      const hasEventTime = !!getTradeSyncEventDate(t);

      // Keep compatibility with varying TradeSync payload formats.
      if (!hasEventTime) return false;
      if (!state) return true;

      return ["closed", "close", "filled", "done"].includes(state);
    });

    /* =========================================
       TOTALS (LIFETIME OR RANGE)
    ========================================= */

    let totalsTrades = closedTrades;

    if (hasCustomRange) {
      const { startUTC, endUTC } = buildRange("range", this.q);

      totalsTrades = closedTrades.filter((t) => {
        const close = new Date(getTradeSyncEventDate(t));
        return close >= startUTC && close <= endUTC;
      });
    }

    const totalTrades = totalsTrades.length;
    const netProfit = totalsTrades.reduce(
      (sum, t) => sum + (Number(t.profit) || 0),
      0,
    );
    const totalWins = totalsTrades.filter((t) => Number(t.profit || 0) > 0).length;
    const totalLossTrades = totalsTrades.filter(
      (t) => Number(t.profit || 0) < 0,
    ).length;
    const grossProfit = totalsTrades
      .filter((t) => Number(t.profit || 0) > 0)
      .reduce((sum, t) => sum + Number(t.profit || 0), 0);
    const grossLoss = totalsTrades
      .filter((t) => Number(t.profit || 0) < 0)
      .reduce((sum, t) => sum + Math.abs(Number(t.profit || 0)), 0);
    const winRate = totalTrades ? (totalWins / totalTrades) * 100 : 0;
    const profitFactor =
      grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
    const avgProfitPerTrade = totalTrades ? netProfit / totalTrades : 0;

    /* =========================================
       CHART RANGE (DEFAULT 1W)
    ========================================= */

    const safeRangeType = ["today", "1w", "1m", "range"].includes(
      requestedRange,
    )
      ? requestedRange
      : "1w";

    const { startUTC, endUTC } = hasCustomRange
      ? buildRange("range", this.q)
      : buildRange(safeRangeType);

    const chartTrades = closedTrades.filter((t) => {
      const close = new Date(getTradeSyncEventDate(t));
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
    const chartSourceTrades = chartTrades.length ? chartTrades : totalsTrades;

    for (const t of chartSourceTrades) {
      const profit = Number(t.profit ?? 0);
      const label = new Date(getTradeSyncEventDate(t)).toISOString().slice(0, 10);

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

    const tradesPreview = [...totalsTrades]
      .sort((a, b) => {
        const aDate = new Date(getTradeSyncEventDate(a) || 0).getTime();
        const bDate = new Date(getTradeSyncEventDate(b) || 0).getTime();

        return bDate - aDate;
      })
      .slice(0, 10);

    /* =========================================
       FETCH ANALYSES
    ========================================= */

    const analyses = await this.fetchAnalyses(startUTC, endUTC);
    const analysesTotals = await this.fetchAnalysesTotals();

    return {
      mode: "user",
      plan: this.planName,
      accountType: "synced",

      totals: {
        totalTrades,
        winRate: +winRate.toFixed(2),
        totalWins,
        totalLossTrades,
        totalProfit: +grossProfit.toFixed(2),
        totalLoss: +grossLoss.toFixed(2),
        netProfit: +netProfit.toFixed(2),
        profitFactor: +profitFactor.toFixed(2),
        avgProfitPerTrade: +avgProfitPerTrade.toFixed(2),
        ...(analysesTotals || {}),
      },

      charts: {
        profitDistribution,
        plAreaChart,
      },

      analyses,

      insights: this.buildInsights(analyses, totalsTrades),

      trades: tradesPreview,

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

  buildInsights(analyses, trades = []) {
    const { monthlies = [], dailies = [] } = analyses;

    if (!monthlies.length && !dailies.length) {
      if (!trades.length) {
        return {
          trend: "neutral",
          performanceSignal: "neutral",
          message: "No data available",
        };
      }

      const monthlyMap = new Map();
      let positiveTrades = 0;

      for (const trade of trades) {
        const profit = Number(trade.profit || 0);
        const eventDate = new Date(getTradeSyncEventDate(trade));

        if (!Number.isFinite(eventDate.getTime())) {
          continue;
        }

        if (profit > 0) positiveTrades += 1;

        const key = `${eventDate.getUTCFullYear()}-${String(
          eventDate.getUTCMonth() + 1,
        ).padStart(2, "0")}`;

        monthlyMap.set(key, (monthlyMap.get(key) || 0) + profit);
      }

      const months = [...monthlyMap.entries()].sort((a, b) =>
        a[0].localeCompare(b[0]),
      );

      let trend = "neutral";
      if (months.length >= 2) {
        const prev = months[months.length - 2][1];
        const last = months[months.length - 1][1];
        if (last > prev) trend = "trend_up";
        else if (last < prev) trend = "trend_down";
      }

      const winRate = trades.length ? (positiveTrades / trades.length) * 100 : 0;

      let performanceSignal = "neutral";
      if (trend === "trend_up" && winRate >= 55) performanceSignal = "improving";
      else if (trend === "trend_down" && winRate < 50)
        performanceSignal = "weakening";

      return {
        trend,
        performanceSignal,
        winMomentum: +winRate.toFixed(2),
        message: "Insights generated from trade history",
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
      return {
        monthlies: [],
        dailies: [],
      };
    }
  }

  async fetchAnalysesTotals() {
    try {
      const response = await axios.get(
        `https://api.tradesync.com/analyses/${this.account.tradesyncId}`,
        { auth: tradesyncAuth },
      );

      if (response.data?.data) {
        return response.data.data;
      }

      return null;
    } catch (error) {
      console.error("TradeSync analyses totals error:", error.message);
      return null;
    }
  }
}

/* ======================================================
   ADMIN STRATEGY
====================================================== */
class AdminDashboardStrategy extends DashboardStrategy {
  constructor(q) {
    super();
    this.q = q;
  }

  async execute() {
    const requestedRange = this.q?.range || "1w";
    const hasCustomRange =
      requestedRange === "range" && !!this.q?.start && !!this.q?.end;

    const safeRangeType = ["today", "7d", "1w", "1m", "range"].includes(
      requestedRange,
    )
      ? requestedRange
      : "1w";

    const { startUTC, endUTC } = hasCustomRange
      ? buildRange("range", this.q)
      : buildRange(safeRangeType);

    const createdAtWhere = {
      createdAt: {
        [Op.gte]: startUTC,
        [Op.lte]: endUTC,
      },
    };

    const [
      totalUsers,
      totalActiveSubscriptions,
      totalFeedbacks,
      totalBugs,
      totalStudentUsers,
      usersData,
      feedbacksData,
      bugsData,
    ] = await Promise.all([
      User.count(),
      UserSubscription.count({ where: { status: "active" } }),
      Feedback.count(),
      BugReport.count(),
      User.count({ where: { type: "student" } }),
      User.findAll({
        attributes: [
          "id",
          "firstName",
          "lastName",
          "email",
          "type",
          "createdAt",
        ],
        where: createdAtWhere,
        order: [["createdAt", "DESC"]],
      }),
      Feedback.findAll({
        attributes: ["id", "userId", "title", "category", "status", "createdAt"],
        where: createdAtWhere,
        order: [["createdAt", "DESC"]],
      }),
      BugReport.findAll({
        attributes: [
          "id",
          "userId",
          "title",
          "category",
          "priority",
          "status",
          "createdAt",
        ],
        where: createdAtWhere,
        order: [["createdAt", "DESC"]],
      }),
    ]);

    const usersChart = buildCountChart(usersData, startUTC, endUTC);
    const feedbacksChart = buildCountChart(feedbacksData, startUTC, endUTC);
    const bugsChart = buildCountChart(bugsData, startUTC, endUTC);

    return {
      mode: "admin",
      totals: {
        totalUsers,
        totalActiveSubscriptions,
        totalFeedbacks,
        totalBugs,
        totalStudentUsers,
      },
      charts: {
        users: usersChart,
        feedbacks: feedbacksChart,
        bugs: bugsChart,
      },
      datasets: {
        users: usersData,
        feedbacks: feedbacksData,
        bugs: bugsData,
      },
      range: {
        type: hasCustomRange ? "range" : safeRangeType,
        start: startUTC,
        end: endUTC,
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
      return new AdminDashboardStrategy(q);
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
