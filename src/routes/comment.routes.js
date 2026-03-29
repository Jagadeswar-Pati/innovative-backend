import express from 'express';
import {
  createComment,
  getAllComments,
  updateCommentStatus,
  deleteComment,
} from '../controllers/comment.controller.js';
import adminAuth from '../middleware/adminAuth.middleware.js';
import userAuth from '../middleware/userAuth.middleware.js';

const router = express.Router();

router.post('/', userAuth, createComment);

router.use(adminAuth);

router.get('/', getAllComments);
router.patch('/:id/status', updateCommentStatus);
router.delete('/:id', deleteComment);

export default router;
