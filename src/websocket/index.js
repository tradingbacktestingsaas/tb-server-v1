import { Server } from "socket.io";
import { subscribe, unsubscribe } from "./event.js";
import { verifyToken } from "../utils/jwt.js";

export function initWebSocket(server) {
  const io = new Server(server, { cors: { origin: "*" } });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      socket.user = verifyToken(token);
      next();
    } catch (err) {
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.user.id;
    console.log(`User connected: ${userId}`);

    // Default subscriptions
    subscribe(socket, `user:${userId}`);
    subscribe(socket, "broadcast");

    // Dynamic subscription handling
    socket.on("subscribe", (eventType) => subscribe(socket, eventType));
    socket.on("unsubscribe", (eventType) => unsubscribe(socket, eventType));

    socket.on("disconnect", () => {
      console.log(`User disconnected: ${userId}`);
    });
  });

  return io;
}
