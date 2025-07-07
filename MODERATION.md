# Moderation & Content Safety System

## Overview
This document describes the architecture, workflows, and best practices for the automated and manual content moderation system in this project.

---

## Architecture
- **Automated Moderation:** Uses AI/ML to analyze user-generated content and flag, hide, or remove inappropriate material.
- **Manual Review:** Human moderators review high-risk or ambiguous content via a queue system.
- **Content Safety Scoring:** Each content item receives a safety score and category breakdown.
- **Analytics & Reporting:** Tracks moderation actions, queue stats, and system accuracy.

---

## Key Modules & Services
- `ModerationModule`: Orchestrates moderation workflows.
- `AutoModerationService`: Runs automated checks and actions.
- `ManualReviewService`: Handles manual review queue and workflows.
- `ContentSafetyService`: Integrates with AI/ML for content analysis.
- `ModerationAnalyticsService`: Provides metrics, trends, and performance reports.

---

## Entities & Indexes
- **ModerationQueue**: Indexed by `status`, `priority`, `assignedModeratorId`, `createdAt`.
- **ModerationAction**: Indexed by `actionType`, `createdAt`, `moderatorId`.
- **ContentReport**: Indexed by `contentId`, `status`, `createdAt`.
- **SafetyScore**: Indexed by `contentId`, `createdAt`.

---

## Workflows
### 1. Content Submission & Reporting
- User submits or updates content.
- Content is analyzed by `ContentSafetyService` (AI/ML or mock).
- If flagged or reported, a `ContentReport` and `ModerationQueue` entry are created.

### 2. Automated Moderation
- If safety score is low, `AutoModerationService` may hide or remove content automatically.
- Automated actions are logged as `ModerationAction`.

### 3. Manual Review
- High-risk or ambiguous content is queued for manual review.
- Moderators can assign, review, escalate, or resolve items.
- Actions are logged and analytics updated.

### 4. User Suspension/Ban
- If content is severe, the owner can be suspended or banned.
- User status is updated in the `User` entity.

### 5. Analytics & Reporting
- All actions and reviews are tracked for metrics and trends.
- System-wide and moderator-specific reports are available.

---

## API Endpoints (ModerationController)
- `POST /moderation/reports`: Report content.
- `PUT /moderation/queue/:queueId/assign`: Assign content to moderator.
- `PUT /moderation/queue/:queueId/review`: Submit review action.
- `GET /moderation/manual/available`: List available content for review.
- `PUT /moderation/manual/:queueId/assign`: Assign manual review.
- `PUT /moderation/manual/:queueId/submit`: Submit manual review decision.
- `PUT /moderation/manual/:queueId/escalate`: Escalate content.
- `GET /moderation/manual/context/:contentId`: Get content context for review.
- `POST /moderation/safety/:contentId/reanalyze`: Reanalyze content with AI/ML.
- `POST /moderation/auto/:contentId/process`: Trigger automated moderation.

---

## AI/ML Integration
- `ContentSafetyService` supports pluggable AI/ML providers (OpenAI, custom, or mock).
- Configure via `AI_PROVIDER`, `AI_API_KEY`, and `AI_API_ENDPOINT` environment variables.
- Fallback to mock analysis for development/testing.

---

## Best Practices
- Use database indexes for all high-traffic queries.
- Paginate and filter all moderation and analytics queries.
- Use async/background jobs for heavy or batch operations.
- Cache analytics and queue stats if needed for performance.
- Keep AI/ML provider logic modular for easy upgrades.
- Document all custom moderation actions and workflows.

---

## Extending & Maintaining
- To add new content types, update `ContentSafetyService.getContentData` and moderation logic.
- To integrate a new AI/ML provider, implement the provider logic in `performAIAnalysis`.
- Regularly review analytics to improve detection and moderation policies.

---

For further details, see the code comments and service documentation in the respective modules. 