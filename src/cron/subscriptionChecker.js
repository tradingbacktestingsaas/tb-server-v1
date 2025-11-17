import cron from "node-cron";
import { Op } from "sequelize";
import UserSubscription from "../models/user_subscription.model.js";
import Plans from "../models/plan.model.js";
import { createFreeSubscription } from "../services/subscriptionService.js";
import { createNotification } from "../services/notificationService.js";

function startSubscriptionCron() {
  console.log("⏳ Subscription CRON initialized…");

  cron.schedule("0 0 * * *", async () => {
    console.log("🔍 Running daily subscription check at 00:00...");
    try {
      const expiredSubs = await UserSubscription.findAll({
        where: { status: "active", current_period_end: { [Op.ne]: null } },
      });

      for (const sub of expiredSubs) {
        const now = new Date();
        const periodEnd = new Date(sub.current_period_end);

        if (periodEnd <= now) {
          console.log(
            `⚠ Subscription expired: userId=${sub.userId}, subId=${sub.id}`
          );

          const freePlan = await Plans.findOne({ where: { code: "FREE" } });
          if (!freePlan) {
            console.error("❌ FREE plan missing!");
            continue;
          }

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
          });
          console.log(`⬇ User ${sub.userId} downgraded to FREE`);
        }
      }

      console.log("✅ Subscription CRON finished");
    } catch (error) {
      console.error("❌ Subscription CRON failed:", error.message);
    }
  });
}

function reminderSubscriptionCron() {
  console.log("⏳ Subscription reminder CRON initialized…");

  cron.schedule("0 10 * * *", async () => {
    console.log("🔍 Running daily subscription reminder at 10:00...");
    try {
      const activeSubs = await UserSubscription.findAll({
        where: { status: "active", current_period_end: { [Op.ne]: null } },
      });

      const now = new Date();

      for (const sub of activeSubs) {
        const periodEnd = new Date(sub.current_period_end);
        const diffDays = Math.ceil((periodEnd - now) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          await createNotification({
            userId: sub.userId,
            title: "Subscription expiring soon",
            type: "alert",
            message:
              "Your subscription will expire tomorrow. Please renew to continue enjoying premium features.",
          });
          console.log(`📢 Reminder sent to user ${sub.userId}`);
        }
      }

      console.log("✅ Subscription reminder CRON finished");
    } catch (error) {
      console.error("❌ Subscription reminder CRON failed:", error.message);
    }
  });
}

export { startSubscriptionCron, reminderSubscriptionCron };
