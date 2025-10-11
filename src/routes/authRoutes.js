import express from 'express';
const router = express.Router();
import {authController} from '../controllers/authController.js';

// Authentication routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/admin-register', authController.adminRegister);
router.post('/admin-login', authController.adminLogin);

export default router;
