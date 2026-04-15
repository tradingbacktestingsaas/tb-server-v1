import TradeAcc from "../models/trade_account.model.js";
import { Op, Sequelize, where } from "sequelize";
import User from "../models/user.model.js";
import { decrypt, encrypt } from "../utils/cryptoUtil.js";
import { sequelize } from "../config/db.js";
import axios from "axios";
import config from "../config/env.js";
import { auth } from "google-auth-library";
import TradeAccount from "../models/trade_account.model.js";
import Plan from "../models/plan.model.js";
import UserSubscription from "../models/user_subscription.model.js";

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
    v,
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
          `${plan.toUpperCase()} account limit reached for your plan (${plan}). Max allowed: ${limit}.`,
        );
      }
    }

    const syncAccount = await axios.post(
      `${config.trade_sync.url}/accounts`,
      {
        account_name: `${user.firstName.slice(0, 10)} ${user.lastName.slice(
          0,
          10,
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
      },
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
          token: syncAccount.data?.data?.status,
          isActive: false,
        },
        { transaction: t },
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
      `Failed to create trade account: ${error.message || error}`,
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
    },
  );
  return res.data?.data;
}

export async function getBrokers(req) {
  try {
    // 🧩 Extract query params
    const { application = "", limit = 25, page = 1, search } = req.query;
    console.log(req.query);

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
      { auth },
    );

    const allBrokers = res.data?.data || [];

    // 🧩 Step 2: Optional search filter
    const filtered = search
      ? allBrokers.filter((b) =>
          b.name.toLowerCase().includes(search.toLowerCase()),
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
      error.response?.data || error.message,
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
  const allowedTypes = ["FREE", "MT4", "MT5"];
  const requestedType =
    typeof type === "string" ? type.toUpperCase().trim() : null;

  try {
    if (!userId) throw new Error("userId is required");
    if (!tradeAccId) throw new Error("tradeAccId is required");
    if (requestedType && !allowedTypes.includes(requestedType)) {
      throw new Error("Invalid account type");
    }

    const t = await sequelize.transaction();

    try {
      const user = await User.findByPk(userId, {
        attributes: ["id", "plan"],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!user) throw new Error("User not found");

      const tradeAcc = await TradeAcc.findOne({
        where: { id: tradeAccId, userId: user.id },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!tradeAcc) throw new Error("Trade account not found");

      const targetType = requestedType || tradeAcc.type;
      if (!allowedTypes.includes(targetType)) {
        throw new Error("Invalid account type");
      }

      if (tradeAcc.type !== targetType) {
        throw new Error("Account type mismatch");
      }

      if (targetType === "MT4" || targetType === "MT5") {
        if (user.plan === "FREE") {
          throw new Error(
            "Your current plan does not allow SYNC accounts. Please upgrade.",
          );
        }

        if (!tradeAcc.tradesyncId) {
          throw new Error("Trade account is not linked with sync service");
        }

        try {
          const resp = await tradeSyncGet(`/accounts/${tradeAcc.tradesyncId}`);
          const syncedAccount = resp?.data?.data || null;
          if (!syncedAccount) {
            throw new Error(
              "Trade account not found in sync service, please try again later",
            );
          }
        } catch {
          throw new Error(
            "Trade account not found in sync service, please try again later",
          );
        }
      }

      await TradeAcc.update(
        { isActive: false },
        {
          where: {
            userId: user.id,
          },
          transaction: t,
        },
      );

      await tradeAcc.update({ isActive: true }, { transaction: t });

      await t.commit();

      return {
        message: "Trade account switched successfully",
        data: tradeAcc,
        success: true,
      };
    } catch (innerError) {
      await t.rollback();
      throw innerError;
    }
  } catch (err) {
    console.error("Error in switchTradeAcc:", err);
    throw new Error(`Failed to switch trade account: ${err.message}`);
  }
}

export async function activeTradeAcc(q) {
  const { userId, tradeAccId } = q;
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error("User not found");
  }
  const tradeAcc = await TradeAcc.findOne({
    where: { userId, isActive: true },
  });

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

  const t = await sequelize.transaction();
  try {
    // Lock user row so concurrent free-account creations for same user serialize.
    const user = await User.findByPk(userId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!user) throw new Error("User not found");

    await TradeAccount.update(
      { isActive: false },
      {
        where: { userId, type: { [Op.in]: ["MT4", "MT5"] } },
        transaction: t,
      },
    );

    let existing = await TradeAccount.findOne({
      where: { userId, type: "FREE" },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

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
      if (!existing.isActive) {
        existing.isActive = true;
        await existing.save({ transaction: t });
      }

      await t.commit();
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

    existing = await TradeAccount.create(
      {
        userId,
        account_no: accountId,
        investor_password: "",
        broker_server: "",
        broker_server_id: "",
        tradesyncId: null,
        token: null,
        type: "FREE",
        isActive: true,
      },
      { transaction: t },
    );

    if (!existing) throw new Error("Trade account not created");

    await t.commit();
    return {
      message: "Free trade account created successfully",
      tradeAccount: existing,
      user: userData,
      success: true,
    };
  } catch (error) {
    await t.rollback();
    throw error;
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

    if (!userId) {
      throw new Error("userId is required");
    }

    /* ============================= */
    /* FETCH USER + PLAN */
    /* ============================= */

    const user = await User.findByPk(userId, {
      attributes: ["id", "firstName", "lastName", "email", "role"],
      include: [
        {
          model: UserSubscription,
          as: "subscriptions",
          include: [
            {
              model: Plan,
              as: "plan",
              attributes: ["code", "features"],
            },
          ],
        },
      ],
    });

    if (!user) {
      throw new Error("User not found");
    }

    const activeSub =
      user.subscriptions.status === "active" ? user.subscriptions : null;
    console.log("activeSub=========>", activeSub);

    const plan = activeSub?.plan || null;

    const planName = plan?.code?.toUpperCase() || "FREE";
    console.log("PLAN=========>", plan?.dataValues?.features?.account_limit);

    const accountLimit =
      typeof plan?.features === "object"
        ? (plan.features?.account_limit ?? 0)
        : 0;

    const currentAvailableSlots =
      accountLimit -
      (await TradeAcc.count({
        where: { userId, type: { [Op.in]: ["MT4", "MT5"] } },
      }));

    /* ============================= */
    /* BUILD WHERE FILTER */
    /* ============================= */

    const where = {
      userId: user.id,
    };

    if (account_no) {
      where.account_no = { [Op.iLike]: `%${account_no}%` };
    }

    if (broker_server) {
      where.broker_server = { [Op.iLike]: `%${broker_server}%` };
    }

    if (typeof active === "boolean") {
      where.isActive = active;
    }

    // FREE plan → restrict to FREE type
    if (planName === "FREE") {
      where.type = "FREE";
    }

    /* ============================= */
    /* FETCH LOCAL ACCOUNTS */
    /* ============================= */

    const { count, rows } = await TradeAcc.findAndCountAll({
      attributes: [
        "id",
        "account_no",
        "broker_server",
        "broker_server_id",
        "type",
        "token",
        "isActive",
        "tradesyncId",
        "createdAt",
      ],
      where,
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    const localTradeAccs = rows.map((row) => row.get({ plain: true }));

    /* ============================= */
    /* FETCH REMOTE ACCOUNTS (IF PLAN ALLOWS) */
    /* ============================= */

    let remoteTradeAccs = [];

    if (["STANDARD", "ELITE"].includes(planName)) {
      const tradesyncIds = localTradeAccs
        .filter((acc) => acc.tradesyncId)
        .map((acc) => acc.tradesyncId);

      if (tradesyncIds.length > 0) {
        const remoteResponses = await Promise.all(
          tradesyncIds.map(async (id) => {
            try {
              const res = await tradeSyncGet(`/accounts/${id}`);
              return res?.data?.data || res?.data || null;
            } catch (err) {
              console.warn(`TradeSync fetch failed for ${id}:`, err.message);
              return null;
            }
          }),
        );

        remoteTradeAccs = remoteResponses.filter(Boolean).map((acc) => ({
          tradesyncId: acc.id,
          account_no: acc.account_number,
          broker_server: acc.server,
          type: (acc.application || acc.type || "REMOTE").toUpperCase(),
          application: (acc.application || "").toUpperCase(),
          investor_password: acc.password,
          remote: true,
          status: acc.status || "UNKNOWN",
        }));
      }
    }

    /* ============================= */
    /* MERGE LOCAL + REMOTE */
    /* ============================= */

    const tradeAccs = localTradeAccs.map((local) => {
      const remote = remoteTradeAccs.find(
        (r) => Number(r.tradesyncId) === Number(local.tradesyncId),
      );

      if (!remote) return local;

      return {
        ...local,
        ...remote,
        id: local.id, // preserve DB id
        broker_server: local.broker_server,
        broker_server_id: local.broker_server_id,
      };
    });

    /* ============================= */
    /* RETURN CLEAN RESPONSE */
    /* ============================= */

    return {
      success: true,
      message: "Trade accounts fetched successfully",
      tradeAccs,
      totalCount: count, // correct pagination count
      accountLimit,
      currentPlan: planName,
      remainingSlots: currentAvailableSlots,
    };
  } catch (error) {
    console.error("Error in getTradeAccs:", error);

    throw new Error(
      `Failed to fetch trade accounts: ${error.message || error}`,
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
      `Failed to fetch trade account: ${err?.message ?? String(err)}`,
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
          apiError.response?.data || apiError.message,
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
        ["MT4", "MT5"].includes(acc.type),
      );

      if (mtAccount) {
        await TradeAcc.update(
          { isActive: true },
          { where: { id: mtAccount.id } },
        );
      } else {
        // Fallback: choose FREE account if no MT accounts exist
        const freeAccount = remainingAccounts.find(
          (acc) => acc.type === "FREE",
        );
        await TradeAcc.update(
          { isActive: true },
          { where: { id: freeAccount.id } },
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
      },
    };
  } catch (error) {
    console.error("Error in deleteTradeAcc service:", error);
    throw new Error(`Failed to delete trade account: ${error.message}`);
  }
}

export async function updateTradeAcc(accId, accDetails) {
  console.log("ACCOUNT========>", accDetails);

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

      console.log("TradeSync payload========>", payload);
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
            apiError.response?.data || apiError.message,
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
