import TradeAcc from "../models/trade_account.model.js";
import { Op, Sequelize, where } from "sequelize";
import User from "../models/user.model.js";
import { decrypt, encrypt } from "../utils/cryptoUtil.js";
import { sequelize } from "../config/db.js";
import axios from "axios";
import config from "../config/env.js";

const SYNC_LIMITS = {
  FREE: 0,
  STANDARD: 3,
  ELITE: 5,
};
const tradeSyncGet = (path) =>
  axios.get(`${config.trade_sync.url.replace(/\/+$/, "")}${path}`, {
    auth: {
      username: config.trade_sync.key,
      password: config.trade_sync.secret,
    },
    timeout: 8000,
  });

const tradeSyncUpdate = (path, data) =>
  axios.update(`${config.trade_sync.url.replace(/\/+$/, "")}${path}`, {
    auth: {
      username: config.trade_sync.key,
      password: config.trade_sync.secret,
    },
    data: data,
    timeout: 8000,
  });

const isUuid = (v) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
const isNumeric = (v) => /^[0-9]+$/.test(v);

const toDTO = (local, remote) => ({
  id: local.id, // local UUID
  type: local.type, // FREE | MT4 | MT5
  accountId: remote?.account_number ?? local.accountId ?? null,
  broker_server: remote?.broker_server ?? local.broker_server ?? null,
  tradesyncId: local.tradesyncId ?? remote?.id ?? null,
  isActive: !!local.isActive,
  createdAt: local.createdAt,
});

export async function createTradeAcc(accDetails) {
  const t = await sequelize.transaction();
  try {
    if (!accDetails) throw new Error("Trade account details not found");
    if (!accDetails.userId) throw new Error("userId is required");
    if (!accDetails.type) throw new Error("type is required (MT4 | MT5)");
    if (!accDetails.investor_password)
      throw new Error("investor_password is required");

    // 1) Load & lock the user row to avoid race conditions
    const user = await User.findByPk(accDetails.userId, {
      transaction: t,
      lock: t.LOCK.UPDATE, // row-level lock on user
    });
    if (!user) throw new Error("User not found");

    // 3) Enforce SYNC limits by plan
    if (accDetails.type === "MT4" || accDetails.type === "MT5") {
      const limit = SYNC_LIMITS[user?.plan] ?? 0;
      if (limit <= 0) {
        throw new Error(
          "Your current plan does not allow SYNC accounts. Please upgrade."
        );
      }

      const syncedAccounts = await axios.get(
        `${config.trade_sync.url}/accounts`,
        {
          auth: {
            username: config.trade_sync.key,
            password: config.trade_sync.secret,
          },
        }
      );

      if (syncedAccounts.data.meta.count >= limit) {
        throw new Error(
          `SYNC account limit reached for your plan (${plan}). Max allowed: ${limit}.`
        );
      }
    }

    const syncAccount = await axios.post(`${config.trade_sync.url}/accounts`, {
      body: {
        account_name: "",
        account_number: "",
        password: "",
        application: "",
        broker_server_id: "",
        type: "readonly",
      },
      auth: {
        username: config.trade_sync.key,
        password: config.trade_sync.secret,
      },
    });

    await t.commit();

    return {
      message: "Trade account created successfully",
      data: syncAccount.data?.data,
      success: true,
    };
  } catch (error) {
    await t.rollback();
    console.error("Error in createTradeAcc:", error);
    throw new Error(
      `Failed to create trade account: ${error.message || error}`
    );
  }
}

export async function getBrokers(options) {
  const { application, limit = 10, offset = 0 } = options;
  const brokers = await tradeSyncGet(
    `/broker-servers?application=${application}&page=${offset}&limit=${limit}`
  );
  if (!brokers) {
    return {
      data: null,
      success: false,
      message: "failed",
    };
  }
  return {
    data: brokers.data.data.results,
    count: brokers.data.data.meta.count,
    success: true,
    message: "retrieved",
  };
}

export async function switchTradeAcc({ userId, tradeAccId, type }) {
  try {
    if (!tradeAccId) {
      throw new Error("tradeAccId is required");
    }

    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Handle FREE local accounts
    if (type === "FREE") {
      const tradeAcc = await TradeAcc.findByPk(tradeAccId);
      if (!tradeAcc) {
        throw new Error("Trade account not found");
      }

      // Ensure the account belongs to the user (safety check)
      if (tradeAcc.userId && String(tradeAcc.userId) !== String(user.id)) {
        throw new Error("Trade account does not belong to the user");
      }

      user.activeTradeAccountId = tradeAccId;
      await user.save();
      return {
        message: "Trade account switched successfully",
        data: tradeAcc,
        success: true,
      };
    }

    // SYNC accounts (MT4/MT5)
    if (type === "MT4" || type === "MT5") {
      if (user.plan === "FREE") {
        throw new Error(
          "Your current plan does not allow SYNC accounts. Please upgrade."
        );
      }

      // Ensure the account belongs to the user (safety check)
      const tradeAcc = await TradeAcc.findByPk(tradeAccId);
      if (!tradeAcc) {
        throw new Error("Trade account not found");
      }
      if (tradeAcc.userId && String(tradeAcc.userId) !== String(user.id)) {
        throw new Error("Trade account does not belong to the user");
      }

      // Try to fetch the specific synced account from the remote service first
      let syncedAccount = null;
      try {
        const resp = await axios.get(
          `${config.trade_sync.url}/accounts/${tradeAcc.tradesyncId}`,
          {
            auth: {
              username: config.trade_sync.key,
              password: config.trade_sync.secret,
            },
          }
        );
        syncedAccount = resp?.data?.data || null;
      } catch (err) {
        // If fetching single account fails, fallback to listing and finding
        try {
          const listResp = await axios.get(
            `${config.trade_sync.url}/accounts`,
            {
              auth: {
                username: config.trade_sync.key,
                password: config.trade_sync.secret,
              },
            }
          );
          const accounts = listResp?.data?.data || listResp?.data;
          if (Array.isArray(accounts)) {
            syncedAccount = accounts.find(
              (acc) => String(acc.id) === String(tradeAccId)
            );
          }
        } catch (listErr) {
          // no-op - we'll handle not found below
        }
      }

      if (!syncedAccount) {
        throw new Error("Trade account not found");
      }

      user.activeTradeAccountId = tradeAcc.id;
      await user.save();
      return {
        message: "Trade account switched successfully",
        data: tradeAcc,
        success: true,
      };
    }

    throw new Error("Invalid account type");
  } catch (err) {
    console.error("Error in switchTradeAcc:", err);
    throw new Error(`Failed to switch trade account: ${err.message || err}`);
  }
}

export async function activeTradeAcc(userId) {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error("User not found");
  }
  const tradeAcc = await TradeAcc.findByPk(user.activeTradeAccountId);
  tradeAcc.investor_password = decrypt(tradeAcc.investor_password);

  if (!tradeAcc) {
    throw new Error("Trade account not found");
  }

  return {
    message: "Trade account switched successfully",
    data: tradeAcc,
    success: true,
  };
}

export async function createFreeTradeAcc(userId) {
  try {
    if (!userId) throw new Error("User ID is required");

    const existing = TradeAcc.findOne({ where: { userId: userId } });

    if (existing) {
      return {
        message: "Downgraded to free",
        data: tradeAcc,
        success: true,
      };
    }

    // Generate random accountId with ACC_ prefix
    const randomSuffix = Math.random().toString(36).slice(2, 10).toUpperCase();
    const accountId = `ACC_${randomSuffix}`;

    // Model requires non-null investor_password and broker_server
    const payload = {
      userId,
      accountId,
      investor_password: "", // stored empty due to NOT NULL constraint
      broker_server: "", // stored empty due to NOT NULL constraint
      tradesyncId: null,
      token: null,
      type: "FREE",
      isActive: true,
    };

    const tradeAcc = await TradeAcc.create(payload);
    if (!tradeAcc) throw new Error("Trade account not created");

    return {
      message: "Free trade account created successfully",
      data: tradeAcc,
      success: true,
    };
  } catch (error) {
    console.error("Error in createFreeTradeAcc service:", error);
    throw new Error(`Failed to create free trade account: ${error}`);
  }
}

export async function getTradeAccs(options = {}) {
  try {
    const {
      accountId,
      broker_server,
      userId,
      active,
      limit = 10,
      offset = 0,
    } = options;

    const where = {};

    const user = await User.findByPk(userId);

    if (!user) {
      throw new Error("User not found");
    }

    if (accountId) {
      where.accountId = { [Op.iLike]: `%${accountId}%` };
    }

    if (broker_server) {
      where.broker_server = { [Op.iLike]: `%${broker_server}%` };
    }

    if (typeof active === "boolean") {
      where.active = active;
    }

    if (userId) {
      where.userId = user.id;
    }

    if (user.plan === "FREE") {
      where.type = "FREE";
    }

    const { count, rows } = await TradeAcc.findAndCountAll({
      attributes: ["id", "accountId", "broker_server", "type", "tradesyncId"],
      where,
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    return {
      tradeAccs: rows,
      totalCount: count,
      success: true,
      message: "Trade accounts fetched successfully",
    };
  } catch (error) {
    console.error("Error in getTradeAccs service:", error);
    throw new Error(
      `Failed to fetch trade accounts: ${error.message || error}`
    );
  }
}

export async function getTradeAccById(accountId, userId) {
  try {
    if (!accountId) throw new Error("accountId is required");
    if (!userId) throw new Error("userId is required");

    const user = await User.findByPk(userId);
    if (!user) throw new Error("User not found");

    // 1) LOCAL FIRST (by id → tradesyncId → accountId)
    let local = null;
    if (isUuid(accountId)) {
      local = await TradeAcc.findOne({ where: { id: accountId, userId } });
    }
    if (!local && isNumeric(accountId)) {
      local = await TradeAcc.findOne({
        where: { tradesyncId: accountId, userId },
      });
    }
    if (!local) {
      local = await TradeAcc.findOne({
        where: { userId, accountId: accountId },
        order: [["createdAt", "DESC"]],
      });
    }
    if (!local) throw new Error("Trade account not found");

    const isSync = local.type === "MT4" || local.type === "MT5";
    const lookedBySyncId =
      isNumeric(accountId) || accountId === String(local.tradesyncId);

    // 2) FREE plan rule → always return FREE account
    if (user.plan === "" && (isSync || lookedBySyncId)) {
      const freeAcc = await TradeAcc.findOne({
        where: { userId, type: "FREE" },
        order: [["createdAt", "DESC"]],
      });
      if (!freeAcc)
        throw new Error("No free trade account available for this user.");
      return {
        success: true,
        message: "FREE plan: returning FREE account.",
        data: toDTO(freeAcc),
      };
    }

    // 3) Paid: merge with TradeSync if applicable (best-effort)
    let remote = null;
    if (isSync && local.tradesyncId) {
      try {
        const r = await tradeSyncGet(`/accounts/${local.tradesyncId}`);
        remote = r.data?.data ?? r.data ?? null;
      } catch {
        /* ignore remote errors, return local only */
      }
    }

    return {
      success: true,
      message: "Trade account fetched.",
      data: toDTO(local, remote),
    };
  } catch (err) {
    console.error("getTradeAccById error:", err);
    throw new Error(
      `Failed to fetch trade account: ${err?.message ?? String(err)}`
    );
  }
}

export async function bulkCreateTradeAccs(accDetails) {
  try {
    if (!accDetails) {
      throw new Error("Trade account details not found");
    }

    accDetails.forEach((acc) => {
      acc.investor_password = encrypt(acc.investor_password);
    });

    const tradeAccs = await TradeAcc.bulkCreate(accDetails, {
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
}

export async function bulkDeleteTradeAccs(accIds) {
  try {
    const tradeAccs = await TradeAcc.destroy({
      where: {
        id: {
          [Op.in]: accIds,
        },
      },
    });

    if (!tradeAccs) {
      throw new Error("Trade accounts not found");
    }

    return {
      message: "Trade accounts deleted successfully",
      data: tradeAccs,
      success: true,
    };
  } catch (error) {
    console.error("Error in bulkDeleteTradeAccs service:", error);
    throw new Error(`Failed to delete trade accounts: ${error}`);
  }
}

export async function deleteTradeAcc(accId) {
  try {
    // 1️⃣ Find trade account with user
    const tradeAcc = await TradeAcc.findByPk(accId, {
      include: [{ model: User, as: "user" }],
    });

    if (!tradeAcc) {
      throw new Error("Trade account not found");
    }

    // 2️⃣ Check if eligible for TradeSync deletion
    const isMTType = ["MT4", "MT5"].includes(tradeAcc.type);
    const isFreeUser = tradeAcc.user?.plan === "FREE";

    if (isMTType && isFreeUser && tradeAcc.tradesyncId) {
      console.log("🔄 Deleting TradeSync account...");

      const tradesyncAuth = {
        username: process.env.TRADESYNC_API_KEY,
        password: process.env.TRADESYNC_API_SECRET,
      };

      const url = `https://api.tradesync.com/accounts/${tradeAcc.tradesyncId}`;

      try {
        const response = await axios.delete(url, { auth: tradesyncAuth });

        if (response.data?.result === "success") {
          console.log("✅ TradeSync account deleted successfully");
        } else {
          console.warn("⚠️ TradeSync deletion returned:", response.data);
        }
      } catch (apiError) {
        console.error(
          "❌ TradeSync API delete error:",
          apiError.response?.data || apiError.message
        );
      }
    }

    // 3️⃣ Delete locally from DB
    await tradeAcc.destroy();

    return {
      success: true,
      message: "Trade account deleted successfully",
      data: tradeAcc,
    };
  } catch (error) {
    console.error("Error in deleteTradeAcc service:", error);
    throw new Error(`Failed to delete trade account: ${error.message}`);
  }
}

export async function updateTradeAcc(accId, accDetails) {
  try {
    const tradeAcc = await TradeAcc.findByPk(accId, {
      include: [{ model: User, as: "user" }],
    });

    if (!tradeAcc) {
      throw new Error("Trade account not found");
    }

    // Encrypt investor password if provided
    if (accDetails?.investor_password) {
      accDetails.investor_password = encrypt(accDetails.investor_password);
    }

    // ✅ Only sync with TradeSync if: MT4 or MT5 and user plan is FREE
    const isMTType = ["MT4", "MT5"].includes(tradeAcc.type);
    const isFreeUser = tradeAcc.user?.plan === "FREE";

    if (isMTType && isFreeUser && tradeAcc.tradesyncId) {
      console.log("🔄 Updating TradeSync connection...");

      // TradeSync request payload (must match API docs)
      const payload = {
        broker_server_id:
          accDetails.broker_server_id || tradeAcc.broker_server_id,
        password: accDetails.password || accDetails.investor_password, // depends on your naming
      };

      // Validation check
      if (!payload.broker_server_id || !payload.password) {
        console.warn("⚠️ Missing required fields for TradeSync update");
      } else {
        // Auth credentials from .env
        const tradesyncAuth = {
          username: process.env.TRADESYNC_API_KEY,
          password: process.env.TRADESYNC_API_SECRET,
        };

        // Make API request to update connection
        const url = `https://api.tradesync.com/accounts/${tradeAcc.tradesyncId}/connection`;

        try {
          const response = await axios.put(url, payload, {
            auth: tradesyncAuth,
          });

          if (response.data?.result === "success") {
            console.log("✅ TradeSync connection updated successfully");
          } else {
            console.warn("⚠️ TradeSync update returned:", response.data);
          }
        } catch (apiError) {
          console.error(
            "❌ TradeSync API error:",
            apiError.response?.data || apiError.message
          );
        }
      }
    }

    // Update locally in your database
    const updatedTradeAcc = await tradeAcc.update(accDetails);

    return {
      success: true,
      message: "Trade account updated successfully",
      data: updatedTradeAcc,
    };
  } catch (error) {
    console.error("Error in updateTradeAcc service:", error);
    throw new Error(`Failed to update trade account: ${error.message}`);
  }
}

export const tradeAccService = {
  bulkCreateTradeAccs,
  bulkDeleteTradeAccs,
  getTradeAccs,
  createTradeAcc,
  getTradeAccById,
  createFreeTradeAcc,
  updateTradeAcc,
  deleteTradeAcc,
  activeTradeAcc,
  switchTradeAcc,
  getBrokers,
};
