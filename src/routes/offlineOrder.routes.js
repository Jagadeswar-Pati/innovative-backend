import express from 'express';
import adminAuth from '../middleware/adminAuth.middleware.js';
import {
  getOfflineOrders,
  createOfflineOrder,
  updateOfflineOrder,
  deleteOfflineOrder,
  streamOfflineBill,
  streamUploadedOfflineBill,
} from '../controllers/offlineOrder.controller.js';

const router = express.Router();

router.use(adminAuth);
router.get('/', getOfflineOrders);
router.get('/:id/bill', streamOfflineBill);
router.get('/:id/uploaded-bill/:type', streamUploadedOfflineBill);
router.post('/', createOfflineOrder);
router.put('/:id', updateOfflineOrder);
router.delete('/:id', deleteOfflineOrder);

export default router;
