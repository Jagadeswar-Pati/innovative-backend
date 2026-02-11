import express from 'express';
import multer from 'multer';
import { submitContactForm } from '../controllers/contact.controller.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
});

router.post('/', upload.array('files', 5), submitContactForm);

export default router;
