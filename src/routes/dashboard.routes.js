import express from 'express';
import { getStats, getRecentOrders, getActivityAlerts, getMostDemandingProducts, getProfitInsights } from '../controllers/dashboard.controller.js';
import adminAuth from '../middleware/adminAuth.middleware.js';

const router = express.Router();

router.use(adminAuth);

router.get('/stats', getStats);
router.get('/recent-orders', getRecentOrders);
router.get('/activity-alerts', getActivityAlerts);
router.get('/top-products', getMostDemandingProducts);
router.get('/profit-insights', getProfitInsights);

export default router;