import express from 'express';
import adminAuth from '../middleware/adminAuth.middleware.js';
import { getProfitProducts, updateProfitPricing } from '../controllers/profit.controller.js';

const router = express.Router();

router.use(adminAuth);

router.get('/products', getProfitProducts);
router.patch('/products/:productId/pricing', updateProfitPricing);

export default router;
