import TradeAcc from "../models/trade_account.model.js";
import { Op, Sequelize, where } from "sequelize";
import User from "../models/user.model.js";
import { decrypt, encrypt } from "../utils/cryptoUtil.js";

export async function createTradeAcc(accDetails) {
  try {
    if (!accDetails) {
      throw new Error("Trade account details not found");
    }

    accDetails.investor_password = encrypt(accDetails.investor_password);

    const tradeAcc = await TradeAcc.create(accDetails);
    if (!tradeAcc) {
      throw new Error("Trade account not created");
    }
    return {
      message: "Trade account created successfully",
      data: tradeAcc,
      success: true,
    };
  } catch (error) {
    console.error("Error in createTradeAcc service:", error);
    throw new Error(`Failed to create trade account: ${error}`);
  }
}

export async function switchTradeAcc({ userId, tradeAccId }) {
  let payload = {};
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const tradeAcc = await TradeAcc.findOne({
      where: {
        id: tradeAccId,
        userId,
      },
    });

    if (!tradeAcc) {
      throw new Error("Trade-account not found");
    }

    if (tradeAcc.type === "FREE") {
      payload.activeTradeAccountId = tradeAcc.id;
      user.activeTradeAccountId = tradeAcc.id;
      await user.save();
      return {
        message: "successfully switched to free account.",
        data: payload,
        success: true,
      };
    }

    if (tradeAcc.type === "SYNC") {
      if (user.plan === "FREE") {
        return {
          messge: "You are not allow to switch on current plan",
          success: false,
          data: null,
        };
      }
      payload.activeTradeAccountId = tradeAcc.id;
      payload.tradesyncId = tradeAcc.tradesyncId;
      user.activeTradeAccountId = tradeAcc.id;
      await user.save();
      return {
        message: "successfully switched to sync account.",
        data: payload,
        success: true,
      };
    }
  } catch (error) {
    console.error("Error in switchTradeAcc service:", error);
    throw new Error(`Failed to switch trade account: ${error}`);
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
    const user = await User.findByPk(userId);
    if (!user) throw new Error("User not found");

    const acc = await TradeAcc.findOne({
      where: { id: accountId, userId }, // prevents cross-tenant access
      attributes: [
        "id",
        "userId",
        "broker_server",
        "accountId",
        "type",
        "investor_password",
        "tradesyncId",
        "createdAt",
      ],
    });

    if (!acc) throw new Error("Trade account not found");

    // Helper to serialize and decrypt before returning
    const serialize = (instance) => {
      const json = instance.toJSON ? instance.toJSON() : instance;
      if (json.investor_password) {
        json.investor_password = decrypt(json.investor_password);
      }
      return json;
    };

    // 1) FREE accounts:
    // - If the user is on FREE plan, return the requested FREE account.
    // - Otherwise, return the requested FREE account (if any).
    if (acc.type === "FREE") {
      return {
        message: "Successfully fetched free account.",
        data: serialize(acc),
        success: true,
      };
    }

    // 2) SYNC accounts:
    // - If the user is on FREE plan, fall back to their FREE account (if any).
    // - Otherwise, return the requested SYNC account.
    if (acc.type === "SYNC") {
      if (user.plan === "FREE") {
        const freeAcc = await TradeAcc.findOne({
          where: { userId: user.id, type: "FREE" },
          attributes: [
            "id",
            "userId",
            "broker_server",
            "accountId",
            "type",
            "investor_password",
            "tradesyncId",
            "createdAt",
          ],
          order: [["createdAt", "DESC"]],
        });

        if (!freeAcc) {
          // Decide your product behavior: error vs. empty response.
          // Here we error explicitly to make the state clear.
          throw new Error("No free trade account available for this user.");
        }

        return {
          message:
            "Successfully fetched free account (SYNC not available on FREE plan).",
          data: serialize(freeAcc),
          success: true,
        };
      } else {
        return {
          message: "Trade account fetched successfully.",
          data: serialize(acc),
          success: true,
        };
      }
    }

    return {
      message: "Trade account fetched successfully.",
      data: serialize(acc),
      success: true,
    };
  } catch (err) {
    console.error("Error in getTradeAccById service:", err);
    // Avoid leaking internals in the thrown error; keep logs detailed, user-facing message generic
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
    const tradeAcc = await TradeAcc.findByPk(accId);
    if (!tradeAcc) {
      throw new Error("Trade account not found");
    }
    await tradeAcc.destroy();
    return {
      message: "Trade account deleted successfully",
      data: tradeAcc,
      success: true,
    };
  } catch (error) {
    console.error("Error in deleteTradeAcc service:", error);
    throw new Error(`Failed to delete trade account: ${error}`);
  }
}

export async function updateTradeAcc(accId, accDetails) {
  try {
    const tradeAcc = await TradeAcc.findByPk(accId);
    if (!tradeAcc) {
      throw new Error("Trade account not found");
    }

    if (accDetails?.investor_password)
      accDetails.investor_password = encrypt(accDetails.investor_password);

    const updatedTradeAcc = await tradeAcc.update(accDetails);
    if (!updatedTradeAcc) {
      throw new Error("Trade account not updated");
    }

    return {
      message: "Trade account updated successfully",
      data: tradeAcc,
      success: true,
    };
  } catch (error) {
    console.error("Error in updateTradeAcc service:", error);
    throw new Error(`Failed to update trade account: ${error}`);
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
};
