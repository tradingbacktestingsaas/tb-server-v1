import User from "../models/user.model.js";
import { createNotification } from "./notificationService.js";
import { sendEmail } from "../utils/email.js";

const buildEmailHtml = ({ firstName, title, message }) => `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <h2>${title}</h2>
    <p>Hello ${firstName || "Trader"},</p>
    <p>${message}</p>
    <p>Thank you for using Trading Backtesting Platform.</p>
  </div>
`;

export async function sendSubscriptionUpdate(update) {
  const {
    userId,
    title,
    type = "alert",
    message,
    data,
    emailSubject,
    emailText,
    emailHtml,
  } = update;

  if (!userId || !title || !message) {
    return;
  }

  const user = await User.findByPk(userId, {
    attributes: [
      "id",
      "firstName",
      "email",
      "is_notifications_enabled",
      "is_update_enabled",
    ],
  });

  if (!user) {
    return;
  }

  if (user.is_notifications_enabled) {
    await createNotification({
      userId,
      title,
      type,
      message,
      data,
    });
  }

  if (user.is_update_enabled && user.email) {
    const subject = emailSubject || title;
    const text = emailText || message;
    const html =
      emailHtml ||
      buildEmailHtml({
        firstName: user.firstName,
        title: subject,
        message,
      });

    await sendEmail(user.email, subject, text, html);
  }
}
