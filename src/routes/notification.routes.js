import express from 'express';
import { getAllNotifications, markAsRead, markAllAsRead } from '../controllers/notification.controller.js';
import adminAuth from '../middleware/adminAuth.middleware.js';

const router = express.Router();

router.use(adminAuth);

router.get('/', getAllNotifications);
router.patch('/:id/read', markAsRead);
router.patch('/read-all', markAllAsRead);

export default router;