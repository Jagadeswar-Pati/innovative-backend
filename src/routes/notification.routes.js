import express from 'express';
import { getAllNotifications, markAsRead, markAllAsRead, deleteNotification } from '../controllers/notification.controller.js';
import adminAuth from '../middleware/adminAuth.middleware.js';

const router = express.Router();

router.use(adminAuth);

router.get('/', getAllNotifications);
router.patch('/:id/read', markAsRead);
router.patch('/read-all', markAllAsRead);
router.delete('/:id', deleteNotification);

export default router;