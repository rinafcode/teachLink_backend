const ModerationItem = require('../models/ModerationItem');

/**
 * Fetches all items with a 'pending' status, sorted oldest first.
 */
exports.getPendingQueue = async (req, res) => {
  try {
    const queue = await ModerationItem.find({ status: 'pending' })
      .sort({ createdAt: 1 }) // Oldest first
      .populate('flaggedBy', 'username email');

    return res.status(200).json({
      success: true,
      count: queue.length,
      data: queue,
    });
  } catch (error) {
    console.error(`[ModerationController][getPendingQueue] Error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch moderation queue.',
      error: error.message,
    });
  }
};

/**
 * Reviews a specific moderation item and performs necessary side effects on the source content.
 */
exports.reviewContentItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, moderatorId, reason } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action. Must be 'approve' or 'reject'.",
      });
    }

    const item = await ModerationItem.findById(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Moderation item not found.',
      });
    }

    const finalStatus = action === 'approve' ? 'approved' : 'rejected';

    // Update the moderation record
    item.status = finalStatus;
    item.reviewedBy = moderatorId;
    if (reason) item.reasons.push(reason);
    await item.save();

    // If rejected, simulate the logic to hide or delete the original source content
    if (action === 'reject') {
      await handleContentRejection(item.contentType, item.contentId);
    }

    return res.status(200).json({
      success: true,
      message: `Content ${finalStatus} successfully.`,
      data: item,
    });
  } catch (error) {
    console.error(`[ModerationController][reviewContentItem] Error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while processing the review.',
      error: error.message,
    });
  }
};

/**
 * Stub logic for handling the removal or hiding of rejected content.
 */
async function handleContentRejection(contentType, contentId) {
  console.log(`[Moderation System] Rejecting ${contentType} with ID: ${contentId}`);
  
  // In a real implementation, you would import the relevant models (Post, Comment, etc.)
  // and execute logic like:
  // if (contentType === 'Post') await Post.findByIdAndUpdate(contentId, { isDeleted: true, status: 'removed' });
  // if (contentType === 'Profile') await User.findByIdAndUpdate(contentId, { isSuspended: true });
  
  return Promise.resolve();
}