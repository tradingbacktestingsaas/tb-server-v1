import express from "express";
import { usersController } from "../controllers/usersController.js";
import auth from "../middlewares/auth.js";
import { upload } from "../utils/upload.js";
import { buildCompressor } from "../utils/imageCompression.js";

const compress = buildCompressor({
  maxWidth: 1920, // downscale wide images
  format: "webp", // 'webp' | 'avif' | 'jpeg' | 'png'
  quality: 80,
});

const router = express.Router();
router.get("/get", usersController.getUsers);
router.get("/get/:id", usersController.getUserById);
router.patch("/update/:id", usersController.updateUser);
router.delete("/delete/:id", usersController.deleteUser);
router.post(
  "/upload-avatar/:id",
  upload.single("file"),
  compress,
  usersController.uploadAvatar
);
router.patch("/change-password/:id", usersController.changePassword);
router.post("/bulk-create", auth(["admin"]), usersController.bulkCreateUsers);
router.delete("/bulk-delete", auth(["admin"]), usersController.bulkDeleteUsers);

export default router;
