import cron from "node-cron";
import { Op } from "sequelize";
import UserSubscription from "../models/user_subscription.model.js";
import Plans from "../models/plan.model.js";
import { createFreeSubscription } from "../services/subscriptionService.js";
import { createNotification } from "../services/notificationService.js";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function startSubscriptionCron() {
  console.log("Subscription CRON initialized (every 6 hours)");

  cron.schedule("0 */6 * * *", async () => {
    console.log("Running 6-hour subscription check...");

    try {
      const activeSubs = await UserSubscription.findAll({
        where: { status: "active", current_period_end: { [Op.ne]: null } },
      });

      const freePlan = await Plans.findOne({ where: { code: "FREE" } });
      if (!freePlan) {
        console.error("FREE plan missing. Skipping subscription cron run.");
        return;
      }

      for (const sub of activeSubs) {
        const now = new Date();
        const periodEnd = new Date(sub.current_period_end);
        const diffMs = periodEnd.getTime() - now.getTime();

        // Send reminder one week before expiry, with a 6-hour matching window.
        if (diffMs <= SEVEN_DAYS_MS && diffMs > SEVEN_DAYS_MS - SIX_HOURS_MS) {
          await createNotification({
            userId: sub.userId,
            title: "Subscription expiring in 7 days",
            type: "reminder",
            message:
              "Your subscription will expire in about 7 days. Renew now to avoid interruption.",
            data: {
              kind: "subscription-expiry-warning",
              subscriptionId: sub.id,
              periodEnd: sub.current_period_end,
            },
          });
        }

        if (diffMs <= 0) {
          await createFreeSubscription({
            userId: sub.userId,
            planId: freePlan.id,
          });

          await createNotification({
            userId: sub.userId,
            title: "Subscription expired",
            type: "alert",
            message:
              "Your subscription has expired. You have been downgraded to FREE.",
            data: {
              kind: "subscription-expired",
              subscriptionId: sub.id,
            },
          });
        }
      }

      console.log("Subscription CRON finished");
    } catch (error) {
      console.error("Subscription CRON failed:", error.message);
    }
  });
}

function reminderSubscriptionCron() {
  // Kept for backward compatibility with existing imports/calls.
  // All reminder/expiry checks are handled inside startSubscriptionCron().
  console.log("Subscription reminder CRON merged into 6-hour subscription cron");
}

export { startSubscriptionCron, reminderSubscriptionCron };
