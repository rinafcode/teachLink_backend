const express = require('express');
const router = express.Router();
const moderationController = require('../controllers/moderation.controller');

// GET /api/moderation/queue -> Fetches pending items sorted by oldest first
router.get('/queue', moderationController.getPendingQueue);

// POST /api/moderation/review/:id -> Approve or reject a specific content item
router.post('/review/:id', moderationController.reviewContentItem);

module.exports = router;