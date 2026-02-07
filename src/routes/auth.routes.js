import express from 'express';
import { register, login, googleLogin, getMe, logout, forgotPassword, resetPassword } from '../controllers/auth.controller.js';
import userAuth from '../middleware/userAuth.middleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google-login', googleLogin);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', userAuth, getMe);
router.post('/logout', logout);

export default router;
