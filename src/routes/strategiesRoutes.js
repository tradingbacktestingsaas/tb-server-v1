import express from "express";
import { strategiesController } from "../controllers/strategiesController.js";
import auth from "../middlewares/auth.js";

const router = express.Router();
router.post("/create", strategiesController.createStrategies);
router.get("/get", strategiesController.getStrategies);
router.patch("/update", strategiesController.updateStrategies);
router.delete("/delete", strategiesController.deleteStrategies);


export default router;
