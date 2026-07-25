const mongoose = require('mongoose');

const ModerationItemSchema = new mongoose.Schema(
  {
    contentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      // Dynamic ref based on contentType if needed for populations
      refPath: 'contentType',
    },
    contentType: {
      type: String,
      required: true,
      enum: ['Post', 'Comment', 'Profile'],
    },
    contentSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      comment: 'Copy of the flagged text or data at the time of flagging',
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    flaggedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reasons: [
      {
        type: String,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('ModerationItem', ModerationItemSchema);