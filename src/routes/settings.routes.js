import express from 'express';
import adminAuth from '../middleware/adminAuth.middleware.js';
import { changePassword, getSettings, updateSettings } from '../controllers/settings.controller.js';

const router = express.Router();

router.post('/change-password', adminAuth, changePassword);
router.get('/', adminAuth, getSettings);
router.put('/', adminAuth, updateSettings);

export default router;