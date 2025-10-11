import express from 'express';
import {usersController} from '../controllers/usersController.js';
import auth from '../middlewares/auth.js';

const router = express.Router();

router.get('/users', auth(['admin']), usersController.getUsers);

export default router;