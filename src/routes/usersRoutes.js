import express from "express";
import { usersController } from "../controllers/usersController.js";
import auth from "../middlewares/auth.js";

const router = express.Router();
router.get("/get", usersController.getUsers);
router.get("/get/:id", usersController.getUserById);
router.patch("/update/:id", usersController.updateUser);
router.delete("/delete/:id", usersController.deleteUser);
router.patch("/change-password/:id", usersController.changePassword);
router.post("/bulk-create", auth(["admin"]), usersController.bulkCreateUsers);
router.delete("/bulk-delete", auth(["admin"]), usersController.bulkDeleteUsers);

export default router;
