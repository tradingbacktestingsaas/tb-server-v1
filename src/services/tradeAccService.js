import TradeAcc from "../models/trade_account.model.js";
import { Op, Sequelize, where } from "sequelize";
import User from "../models/user.model.js";
import { decrypt, encrypt } from "../utils/cryptoUtil.js";
import { sequelize } from "../config/db.js";
import axios from "axios";
import config from "../config/env.js";
import { auth } from "google-auth-library";
import TradeAccount from "../models/trade_account.model.js";

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
const isUuid = (v) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
const isNumeric = (v) => /^[0-9]+$/.test(v);

const toDTO = (local, remote) => ({
  id: local.id, // local UUID
  type: local.type, // FREE | MT4 | MT5
  account_no: remote?.account_number ?? local.account_no ?? null,
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
    if (!accDetails.broker_server) throw new Error("type is broker_server");
    if (!accDetails.broker_name) throw new Error("type is broker_name");
    if (!accDetails.investor_password)
      throw new Error("investor_password is required");

    // 1) Load & lock the user row to avoid race conditions
    const user = await User.findByPk(accDetails.userId, {
      transaction: t,
      lock: t.LOCK.UPDATE, // row-level lock on user
    });
    if (!user) throw new Error("User not found");

    const tradeAcc = await TradeAcc.findAndCountAll({
      where: { userId: accDetails?.userId },
    });

    if (user?.plan === "FREE") {
      return {
        message: "FREE account limit reached",
        data: null,
        success: false,
      };
    }

    // 3) Enforce SYNC limits by plan
    if (accDetails.type === "MT4" || accDetails.type === "MT5") {
      // 2) Enforce FREE limits by plan
      const plan = user?.plan ?? "FREE";
      const limit = SYNC_LIMITS[plan] ?? 0;

      if (tradeAcc.count >= limit) {
        throw new Error(
          `${plan.toUpperCase()} account limit reached for your plan (${plan}). Max allowed: ${limit}.`
        );
      }
    }

    const syncAccount = await axios.post(
      `${config.trade_sync.url}/accounts`,
      {
        account_name: `${user.firstName.slice(0, 10)} ${user.lastName.slice(
          0,
          10
        )}`,
        account_number: accDetails?.account_no ?? null,
        password: accDetails?.investor_password ?? null,
        application: accDetails?.type?.toLowerCase() ?? null,
        broker_server_id: accDetails?.broker_server ?? null,
        type: "readonly",
      },
      {
        auth: {
          username: config.trade_sync.key,
          password: config.trade_sync.secret,
        },
      }
    );

    if (syncAccount?.data?.result === "success") {
      await TradeAcc.create(
        {
          ...accDetails,
          tradesyncId: syncAccount.data?.data?.id,
          broker_server: accDetails?.broker_name,
          userId: accDetails.userId,
        },
        { transaction: t }
      );
    } else {
      return {
        message: "Failed to create trade account",
        data: null,
        success: false,
      };
    }

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

export async function getBrokers(req) {
  try {
    // 🧩 Extract query params
    const { application = "", limit = 25, page = 1, search } = req.query;

    // 🧮 Normalize pagination values
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

    // 🔐 Auth setup
    const auth = {
      username: config.trade_sync.key,
      password: config.trade_sync.secret,
    };

    // 🧩 Step 1: Fetch *all brokers* (API pagination may not work properly)
    const res = await axios.get(
      `${config.trade_sync.url}/broker-servers?application=${
        application.toLowerCase() || ""
      }`,
      { auth }
    );

    const allBrokers = res.data?.data || [];

    // 🧩 Step 2: Optional search filter
    const filtered = search
      ? allBrokers.filter((b) =>
          b.name.toLowerCase().includes(search.toLowerCase())
        )
      : allBrokers;

    // 🧩 Step 3: Manual pagination
    const total = filtered.length;
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedBrokers = filtered.slice(startIndex, startIndex + limitNum);
    const totalPages = Math.ceil(total / limitNum);

    // ✅ Step 4: Return structured response
    return {
      success: true,
      message: "Brokers retrieved successfully",
      data: paginatedBrokers,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
    };
  } catch (error) {
    console.error(
      "❌ Failed to fetch brokers:",
      error.response?.data || error.message
    );

    return {
      success: false,
      message:
        error.response?.data?.message ||
        "Failed to fetch brokers from TradeSync",
      data: [],
      pagination: {
        total: 0,
        page: 1,
        limit: 0,
        totalPages: 0,
      },
    };
  }
}

// export async function getBrokersServer(req) {
//   try {
//     // 🧩 Extract query params
//     const { limit = 25, page = 1, accountId = "" } = req.query;

//     // 🧮 Normalize pagination values
//     const pageNum = Math.max(parseInt(page, 10) || 1, 1);
//     const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

//     // 🔐 Auth setup
//     const auth = {
//       username: config.trade_sync.key,
//       password: config.trade_sync.secret,
//     };

//     // 🧩 Step 1: Fetch *all brokers* (API pagination may not work properly)
//     const res = await axios.get(
//       `${config.trade_sync.url}/broker-servers/${accountId}`,
//       {
//         auth,
//       }
//     );

//     const allBrokers = res.data?.data || [];

//     // ✅ Step 4: Return structured response
//     return {
//       success: true,
//       message: "Brokers retrieved successfully",
//       data: allBrokers,
//       pagination: {
//         page: pageNum,
//         limit: limitNum,
//       },
//     };
//   } catch (error) {
//     console.error(
//       "❌ Failed to fetch brokers:",
//       error.response?.data || error.message
//     );

//     return {
//       success: false,
//       message:
//         error.response?.data?.message ||
//         "Failed to fetch brokers from TradeSync",
//       data: [],
//       pagination: {
//         total: 0,
//         page: 1,
//         limit: 0,
//         totalPages: 0,
//       },
//     };
//   }
// }

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
      const tradeAcc = await TradeAcc.findByPk(tradeAccId, {
        where: { userId: user.id, isActive: false },
      });
      if (!tradeAcc) {
        throw new Error("Trade account not found");
      }

      // Ensure the account belongs to the user (safety check)
      if (tradeAcc.userId && String(tradeAcc.userId) !== String(user.id)) {
        throw new Error("Trade account does not belong to the user");
      }

      tradeAcc.isActive = true;
      await tradeAcc.save();
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
      const tradeAcc = await TradeAcc.findByPk(tradeAccId, {
        where: { userId: user.id, isActive: false },
      });
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

      await tradeAcc.update({ type, isActive: true });
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

    const user = await User.findByPk(userId);
    if (!user) throw new Error("User not found");

    const existing = await TradeAccount.findOne({
      where: { userId: userId, type: "FREE" },
    });

    const activeMTAccounts = await TradeAccount.findAll({
      where: { userId: userId, type: { [Op.in]: ["MT4", "MT5"] } },
    });
    
    if (activeMTAccounts.length > 0) {
      activeMTAccounts.forEach((acc) => (acc.isActive = false));
    }

    if (existing) {
      existing.isActive = true;
      await existing.save();
      return {
        message: "Downgraded to free",
        tradeAccount: existing,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          blocked: user.blocked,
          plan: user.plan,
          avatar_url: user.avatar_url,
          active: user.active,
          type: user.type,
          role: user.role,
        },
        success: true,
      };
    }

    // Generate random accountId with ACC_ prefix
    const randomSuffix = Math.random().toString(36).slice(2, 10).toUpperCase();
    const accountId = `ACC_${randomSuffix}`;

    // Model requires non-null investor_password and broker_server
    const payload = {
      userId,
      account_no: accountId,
      investor_password: "", // stored empty due to NOT NULL constraint
      broker_server: "", // stored empty due to NOT NULL constraint
      tradesyncId: null,
      token: null,
      type: "FREE",
      isActive: true,
    };

    const tradeAccount = await TradeAccount.create(payload);
    if (!tradeAccount) throw new Error("Trade account not created");

    return {
      message: "Free trade account created successfully",
      tradeAccount: tradeAccount,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        blocked: user.blocked,
        plan: user.plan,
        avatar_url: user.avatar_url,
        active: user.active,
        type: user.type,
        role: user.role,
      },
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
      account_no,
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

    if (account_no) {
      where.account_no = { [Op.iLike]: `%${account_no}%` };
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
      attributes: ["id", "account_no", "broker_server", "type", "tradesyncId"],
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
      local = await TradeAcc.findOne({
        where: { id: accountId, userId },
      });
    }
    if (!local && isNumeric(accountId)) {
      local = await TradeAcc.findOne({
        where: { tradesyncId: accountId, userId },
      });
    }
    if (!local) {
      local = await TradeAcc.findOne({
        where: { userId, id: accountId },
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
        where: { userId, type: "FREE", isActive: true },
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

    if (!tradeAcc) throw new Error("Trade account not found");

    const user = tradeAcc.user;
    if (!user) throw new Error("User not found for this trade account");

    // 2️⃣ If it's an MT4/MT5 account, try to delete from TradeSync
    const isMTType = ["MT4", "MT5"].includes(tradeAcc.type);
    const isFreeUser = user.plan === "FREE";

    if (isMTType && !isFreeUser && tradeAcc.tradesyncId) {
      const tradesyncAuth = {
        username: config.trade_sync.key,
        password: config.trade_sync.secret,
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
    let currentAcc = null;
    // 4️⃣ Update activeTradeAccountId logic
    const remainingAccounts = await TradeAcc.findAll({
      where: { userId: user.id },
      order: [["createdAt", "DESC"]],
    });

    if (remainingAccounts.length > 0) {
      // Prefer MT4 or MT5 account
      const mtAccount = remainingAccounts.find((acc) =>
        ["MT4", "MT5"].includes(acc.type)
      );

      if (mtAccount) {
        await TradeAcc.update(
          { isActive: true },
          { where: { id: mtAccount.id } }
        );
      } else {
        // Fallback: choose FREE account if no MT accounts exist
        const freeAccount = remainingAccounts.find(
          (acc) => acc.type === "FREE"
        );
        await TradeAcc.update(
          { isActive: true },
          { where: { id: freeAccount.id } }
        );
      }
    } else {
      return {
        success: true,
        message: "Trade account deleted successfully",
        data: null,
      };
    }

    // 5️⃣ Return result
    return {
      success: true,
      message: "Trade account deleted successfully",
      data: {
        currentAccount: currentAcc,
        deletedAccount: {
          id: tradeAcc.id,
        },
        updatedUser: {
          firstName: user.firstName,
          lastName: user.lastName,
          id: user.id,
          activeTradeAccountId: user.activeTradeAccountId,
          email: user.email,
          role: user.role,
          plan: user.plan,
          blocked: user.blocked,
          type: user.type,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          avatar_url: user.avatar_url,
        },
      },
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
  // getBrokersServer,
};
