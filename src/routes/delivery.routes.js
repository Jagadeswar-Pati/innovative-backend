import express from 'express';
import {
	getStateCharges,
	getAllStateCharges,
	createStateCharge,
	updateStateCharge,
	deleteStateCharge,
	getDeliveryDashboard,
	getDefaultPlatform,
	setDefaultPlatform,
} from '../controllers/delivery.controller.js';
import adminAuth from '../middleware/adminAuth.middleware.js';

const router = express.Router();

// Public (checkout) - get delivery charge for a state
router.get('/state-charges', getStateCharges);

// Admin only
router.use(adminAuth);
router.get('/states', getAllStateCharges);
router.post('/states', createStateCharge);
router.put('/states/:stateId', updateStateCharge);
router.delete('/states/:stateId', deleteStateCharge);
router.get('/dashboard', getDeliveryDashboard);
router.get('/settings/platform', getDefaultPlatform);
router.put('/settings/platform', setDefaultPlatform);

export default router;
