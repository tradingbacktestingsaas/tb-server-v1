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
  broker_server_id: remote?.broker_server_id ?? local.broker_server_id ?? null,
  tradesyncId: local.tradesyncId ?? remote?.id ?? null,
  status: local.status ?? remote?.status ?? null,
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
    if (!accDetails.broker_server_id)
      throw new Error("type is broker_server_id");
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
        broker_server_id: accDetails?.broker_server_id ?? null,
        type: "readonly",
      },
      {
        auth: {
          username: config.trade_sync.key,
          password: config.trade_sync.secret,
        },
      }
    );

    if (!syncAccount) {
      return {
        message: "Invalid Credentials",
        data: null,
        success: false,
      };
    }
    if (syncAccount?.data?.result === "success") {
      await TradeAcc.create(
        {
          ...accDetails,
          tradesyncId: syncAccount.data?.data?.id,
          broker_server: accDetails?.broker_server,
          broker_server_id: accDetails?.broker_server_id,
          userId: accDetails.userId,
        },
        { transaction: t }
      );
    } else {
      return {
        message: "Invalid Credentials",
        data: null,
        success: false,
      };
    }

    await t.commit();

    return {
      message: "Trade account created successfully",
      data: syncAccount.data?.data,
      status: 201,
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

export async function getAccountStatus(tradesyncId) {
  const res = await axios.get(
    `${config.trade_sync.url}/accounts/${tradesyncId}`,
    {
      auth: {
        username: config.trade_sync.key,
        password: config.trade_sync.secret,
      },
    }
  );
  return res.data?.data;
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
    if (!tradeAccId) throw new Error("tradeAccId is required");

    const user = await User.findByPk(userId);
    if (!user) throw new Error("User not found");

    // Fetch the trade account properly
    const tradeAcc = await TradeAcc.findOne({
      where: { id: tradeAccId, userId: user.id },
    });

    if (!tradeAcc) throw new Error("Trade account not found");

    if (tradeAcc.isActive) {
      return {
        message: "Trade account switched successfully",
        data: tradeAcc,
        success: true,
      };
    }

    // ============ FREE ACCOUNT HANDLING ============
    if (type === "FREE") {
      // deactivate all accounts
      await TradeAccount.update(
        { isActive: false },
        {
          where: {
            userId: user.id,
            type: { [Op.in]: ["MT4", "MT5"] },
          },
        }
      );

      // activate the selected one
      await tradeAcc.update({ isActive: true, type: "FREE" });

      return {
        message: "Trade account switched successfully",
        data: tradeAcc,
        success: true,
      };
    }

    // ============ MT4 / MT5 ACCOUNT HANDLING ============
    if (type === "MT4" || type === "MT5") {
      if (user.plan === "FREE") {
        throw new Error(
          "Your current plan does not allow SYNC accounts. Please upgrade."
        );
      }

      // Try remote fetch
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
      } catch {
        // fallback: list all
        const listResp = await axios.get(`${config.trade_sync.url}/accounts`, {
          auth: {
            username: config.trade_sync.key,
            password: config.trade_sync.secret,
          },
        });

        const accounts = listResp?.data?.data || [];
        syncedAccount = accounts.find(
          (acc) => String(acc.id) === String(tradeAcc.tradesyncId)
        );
      }

      if (!syncedAccount)
        throw new Error("Trade account not found in sync service");

      // deactivate all accounts
      await TradeAccount.update(
        { isActive: false },
        {
          where: {
            userId: user.id,
            type: { [Op.in]: ["MT4", "MT5", "FREE"] },
          },
        }
      );

      // activate selected account
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
    throw new Error(`Failed to switch trade account: ${err.message}`);
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
  if (!userId) throw new Error("User ID is required");

  const user = await User.findByPk(userId);
  if (!user) throw new Error("User not found");

  const existing = await TradeAccount.findOne({
    where: { userId, type: "FREE" },
  });

  await TradeAccount.update(
    { isActive: false },
    {
      where: { userId, type: { [Op.in]: ["MT4", "MT5"] } },
    }
  );

  const userData = {
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
  };

  if (existing) {
    existing.isActive = true;
    await existing.save();
    return {
      message: "Downgraded to free",
      tradeAccount: existing,
      user: userData,
      success: true,
    };
  }

  const accountId = `ACC_${Math.random()
    .toString(36)
    .slice(2, 10)
    .toUpperCase()}`;

  const tradeAccount = await TradeAccount.create({
    userId,
    account_no: accountId,
    investor_password: "",
    broker_server: "",
    broker_server_id: "",
    tradesyncId: null,
    token: null,
    type: "FREE",
    isActive: true,
  });

  if (!tradeAccount) throw new Error("Trade account not created");

  return {
    message: "Free trade account created successfully",
    tradeAccount,
    user: userData,
    success: true,
  };
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

    // Filters
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

    // FREE plan → only local FREE accounts
    if (user.plan === "FREE") {
      where.type = "FREE";
    }

    // Fetch LOCAL accounts (MT4 + MT5 stored in DB)
    const { count, rows: localTradeAccs } = await TradeAcc.findAndCountAll({
      attributes: [
        "id",
        "account_no",
        "broker_server",
        "broker_server_id",
        "type",
        "tradesyncId",
      ],
      where,
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    // Remote array holder
    let remoteTradeAccs = [];

    // -------------- TRADE SYNC LOGIC --------------
    if (["STANDARD", "ELITE"].includes(user.plan)) {
      try {
        // 1️⃣ Extract tradesyncIds from local accounts
        const tradesyncIds = localTradeAccs
          .filter((acc) => acc.tradesyncId)
          .map((acc) => acc.tradesyncId);

        // 2️⃣ Request remote account details for each
        const remoteResponses = await Promise.all(
          tradesyncIds.map(async (id) => {
            try {
              const res = await tradeSyncGet(`/accounts/${id}`);
              return res.data?.data || res.data;
            } catch (err) {
              console.warn(
                `Failed to fetch remote account ${id}:`,
                err.message
              );
              return null;
            }
          })
        );

        // 3️⃣ Filter out failed/null responses
        const remoteData = remoteResponses.filter(Boolean);

        // 4️⃣ Normalize remote accounts
        remoteTradeAccs = remoteData.map((acc) => ({
          remoteId: acc.id, // keep remote id separate
          account_no: acc.account_number,
          broker_server: acc.server,
          type: (acc.application || acc.type || "REMOTE").toUpperCase(), // UPPERCASE
          application: (acc.application || "").toUpperCase(),
          tradesyncId: acc.id,
          investor_password: acc.password,
          remote: true,
          status: acc.status || "UNKNOWN",
        }));
      } catch (err) {
        console.warn("TradeSync bulk fetch failed:", err.message);
      }
    }
    // -------------- END TRADE SYNC LOGIC --------------

    // -------------- MERGE REMOTE VALUES INTO LOCAL RECORDS --------------
    const tradeAccs = localTradeAccs.map((local) => {
      const remote = remoteTradeAccs.find(
        (r) => Number(r.tradesyncId) === Number(local.tradesyncId)
      );

      if (!remote) return local;

      return {
        ...local.dataValues, // keep local id
        ...remote, // add remote values
        id: local.id, // FORCE id to remain local DB ID
        broker_server: local.broker_server,
        broker_server_id: local.broker_server_id,
        tradesyncId: remote.tradesyncId,
      };
    });

    return {
      tradeAccs,
      totalCount: tradeAccs.length,
      success: true,
      message: "Trade accounts fetched successfully",
    };
  } catch (error) {
    console.error("Error in getTradeAccs:", error);
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
    let encryptedPassword = null;
    const tradeAcc = await TradeAcc.findByPk(accId, {
      include: [{ model: User, as: "user" }],
    });

    if (!tradeAcc) {
      throw new Error("Trade account not found");
    }

    // Encrypt investor password if provided
    if (accDetails?.investor_password) {
      encryptedPassword = encrypt(accDetails.investor_password);
    }

    // ✅ Only sync with TradeSync if: MT4 or MT5 and user plan is FREE
    const isMTType = ["MT4", "MT5"].includes(tradeAcc.type);
    const isFreeUser = tradeAcc.user?.plan === "FREE";

    if (isMTType && !isFreeUser && tradeAcc.tradesyncId) {
      console.log("🔄 Updating TradeSync connection...");

      // TradeSync request payload (must match API docs)
      const payload = {
        broker_server_id: accDetails.broker_server_id,
        password: accDetails.investor_password, // depends on your naming
      };

      console.log(payload);
      // Validation check
      if (!payload.broker_server_id || !payload.password) {
        console.warn("⚠️ Missing required fields for TradeSync update");
      } else {
        // Auth credentials from .env
        const tradesyncAuth = {
          username: config.trade_sync.key,
          password: config.trade_sync.secret,
        };

        // Make API request to update connection
        const url = `https://api.tradesync.com/accounts/${tradeAcc.tradesyncId}/connection`;

        try {
          const response = await axios.patch(url, payload, {
            auth: tradesyncAuth,
          });
          console.log(response);

          if (response.data?.result === "success") {
            console.log("✅ TradeSync connection updated successfully");
          } else {
            console.warn("⚠️ TradeSync update returned:", response.data);
            return {
              success: false,
              message: "Failed to update TradeSync connection",
              data: response.message,
            };
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
    const updatedTradeAcc = await tradeAcc.update({
      ...accDetails,
      investor_password: encryptedPassword,
    });

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
  getAccountStatus,
  // getBrokersServer,
};
