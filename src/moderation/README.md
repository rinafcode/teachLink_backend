# Content Moderation System

A comprehensive, AI-powered content moderation system for the TeachLink Knowledge Nexus platform. This system provides automated content analysis, manual review workflows, and detailed analytics to maintain platform safety and compliance.

## Features

### 🔍 Automated Content Analysis
- **AI-powered safety scoring** for multiple content categories
- **Real-time content flagging** based on configurable thresholds
- **Automated action triggers** for high-risk content
- **Confidence scoring** for moderation decisions

### 👥 Manual Review Workflow
- **Priority-based queue management** for content review
- **Moderator assignment and tracking**
- **Escalation workflows** for complex cases
- **Review history and context** for informed decisions

### 📊 Analytics & Reporting
- **Moderator performance metrics**
- **System-wide safety trends**
- **Accuracy tracking** and improvement recommendations
- **Queue analytics** for workflow optimization

### 🛡️ Safety Categories
- Violence
- Harassment
- Hate Speech
- Sexual Content
- Spam
- Misinformation
- Copyright Violations
- Privacy Concerns

## Architecture

```
src/moderation/
├── entities/                    # Database entities
│   ├── content-report.entity.ts
│   ├── moderation-queue.entity.ts
│   ├── moderation-action.entity.ts
│   ├── safety-score.entity.ts
│   └── moderation-analytics.entity.ts
├── auto/                       # Automated moderation
│   └── auto-moderation.service.ts
├── manual/                     # Manual review workflows
│   └── manual-review.service.ts
├── safety/                     # Content safety analysis
│   └── content-safety.service.ts
├── analytics/                  # Analytics and reporting
│   └── moderation-analytics.service.ts
├── dto/                        # Data transfer objects
│   ├── create-content-report.dto.ts
│   └── moderation-action.dto.ts
├── moderation.module.ts        # Main module
├── moderation.service.ts       # Core service
├── moderation.controller.ts    # REST API endpoints
└── README.md                   # This file
```

## API Endpoints

### Content Reporting
- `POST /moderation/reports` - Report inappropriate content
- `GET /moderation/reports` - Get content reports (Admin/Teacher)

### Moderation Queue
- `GET /moderation/queue` - Get moderation queue (Admin/Teacher)
- `PUT /moderation/queue/:queueId/assign` - Assign content to moderator
- `PUT /moderation/queue/:queueId/review` - Review content

### Manual Review
- `GET /moderation/manual/available` - Get available content for review
- `PUT /moderation/manual/:queueId/assign` - Self-assign content
- `PUT /moderation/manual/:queueId/start` - Start review process
- `PUT /moderation/manual/:queueId/submit` - Submit review decision
- `PUT /moderation/manual/:queueId/escalate` - Escalate content
- `GET /moderation/manual/history` - Get review history
- `GET /moderation/manual/context/:contentId` - Get content context

### Content Safety
- `GET /moderation/safety/:contentId` - Get safety score
- `POST /moderation/safety/:contentId/reanalyze` - Reanalyze content
- `GET /moderation/safety/trends/:contentId` - Get safety trends
- `GET /moderation/safety/categories` - Get category breakdown

### Auto Moderation
- `POST /moderation/auto/:contentId/process` - Process content (Admin)
- `GET /moderation/auto/stats` - Get auto-moderation stats (Admin)

### Analytics
- `GET /moderation/analytics/moderator/:moderatorId` - Get moderator performance (Admin)
- `GET /moderation/analytics/system` - Get system-wide metrics (Admin)
- `GET /moderation/analytics/accuracy` - Get accuracy metrics (Admin)
- `GET /moderation/analytics/queue` - Get queue metrics (Admin/Teacher)
- `GET /moderation/analytics/safety-trends` - Get safety trends (Admin)

### Health Check
- `GET /moderation/health` - System health status

## Usage Examples

### Reporting Content
```typescript
// Report inappropriate content
const report = await moderationService.reportContent(userId, {
  contentId: 'course-123',
  contentType: 'course',
  reportType: ReportType.INAPPROPRIATE,
  description: 'Content contains inappropriate material',
  evidence: { screenshots: ['url1', 'url2'] }
});
```

### Manual Review Workflow
```typescript
// Get available content for review
const availableContent = await manualReviewService.getAvailableContent(moderatorId);

// Assign content to self
const assigned = await manualReviewService.assignContentToModerator(queueId, moderatorId);

// Start review
const inReview = await manualReviewService.startReview(queueId, moderatorId);

// Submit decision
const result = await manualReviewService.submitReview(queueId, moderatorId, {
  action: ActionType.REMOVE_CONTENT,
  severity: ActionSeverity.HIGH,
  reason: 'Violation of community guidelines',
  evidence: { details: 'Specific violations found' }
});
```

### Safety Analysis
```typescript
// Analyze content safety
const safetyScore = await contentSafetyService.analyzeContent(contentId, 'course');

// Get safety trends
const trends = await contentSafetyService.getSafetyTrends(contentId, 30);

// Get category breakdown
const breakdown = await contentSafetyService.getCategoryBreakdown('course');
```

### Analytics
```typescript
// Get moderator performance
const performance = await moderationAnalyticsService.getModeratorPerformance(
  moderatorId,
  startDate,
  endDate
);

// Get system-wide metrics
const metrics = await moderationAnalyticsService.getSystemWideMetrics(30);

// Get accuracy metrics
const accuracy = await moderationAnalyticsService.getAccuracyMetrics(30);
```

## Configuration

### Safety Thresholds
The system uses configurable thresholds for different safety categories:

```typescript
const SAFETY_THRESHOLDS = {
  [SafetyCategory.VIOLENCE]: 0.3,
  [SafetyCategory.HARASSMENT]: 0.3,
  [SafetyCategory.HATE_SPEECH]: 0.3,
  [SafetyCategory.SEXUAL_CONTENT]: 0.3,
  [SafetyCategory.SPAM]: 0.2,
  [SafetyCategory.MISINFORMATION]: 0.4,
  [SafetyCategory.COPYRIGHT]: 0.5,
  [SafetyCategory.PRIVACY]: 0.6,
};
```

### Auto-Moderation Thresholds
```typescript
const THRESHOLDS = {
  CRITICAL: 0.1, // Auto-remove content
  HIGH: 0.3,     // Auto-hide content
  MEDIUM: 0.5,   // Flag for manual review
  LOW: 0.7,      // Monitor
};
```

## Database Schema

### ContentReport
- Tracks user reports of inappropriate content
- Links to moderation queue and actions
- Supports evidence and resolution tracking

### ModerationQueue
- Manages content review workflow
- Priority-based ordering
- Moderator assignment tracking

### ModerationAction
- Records all moderation decisions
- Supports temporary and permanent actions
- Tracks appeals and escalations

### SafetyScore
- Stores AI analysis results
- Category-specific safety scores
- Confidence and review tracking

### ModerationAnalytics
- Daily moderator performance metrics
- Accuracy and efficiency tracking
- Trend analysis data

## Testing

Run the test suite:

```bash
# Unit tests
npm run test src/moderation

# E2E tests
npm run test:e2e moderation
```

### Test Coverage
- ✅ ModerationService - Core moderation logic
- ✅ AutoModerationService - Automated content analysis
- ✅ ManualReviewService - Review workflow management
- ✅ ContentSafetyService - Safety scoring and analysis
- ✅ ModerationAnalyticsService - Analytics and reporting

## Performance Considerations

### Caching
- Safety scores are cached to avoid repeated analysis
- Queue queries are optimized with proper indexing
- Analytics data is aggregated for efficient querying

### Scalability
- Queue processing supports horizontal scaling
- AI analysis can be distributed across multiple workers
- Database queries are optimized for large datasets

### Monitoring
- Real-time queue metrics
- Moderator performance tracking
- System health monitoring
- Error rate tracking

## Security

### Access Control
- Role-based access control (Admin/Teacher/Student)
- JWT authentication required for all endpoints
- Content-specific permissions

### Data Protection
- Sensitive content is encrypted at rest
- Audit logging for all moderation actions
- GDPR-compliant data handling

### Rate Limiting
- API rate limiting to prevent abuse
- Queue assignment limits per moderator
- Report submission throttling

## Integration

### AI Services
The system is designed to integrate with external AI services for content analysis:

```typescript
// Example integration with external AI service
private async performAIAnalysis(contentData: any): Promise<ContentAnalysisResult> {
  // Integrate with services like:
  // - Google Cloud Vision API
  // - Azure Content Moderator
  // - AWS Rekognition
  // - Custom ML models
}
```

### Notifications
- Email notifications for high-priority content
- Real-time notifications for moderators
- User notifications for report status updates

### Webhooks
- Content status change webhooks
- Moderator action webhooks
- Analytics update webhooks

## Future Enhancements

### Planned Features
- [ ] Machine learning model training pipeline
- [ ] Advanced content similarity detection
- [ ] Multi-language content support
- [ ] Video and audio content analysis
- [ ] Community-driven moderation
- [ ] Appeal and dispute resolution system

### Performance Improvements
- [ ] Redis caching for frequently accessed data
- [ ] Background job processing for heavy operations
- [ ] Database query optimization
- [ ] CDN integration for content delivery

### Analytics Enhancements
- [ ] Real-time dashboard
- [ ] Predictive analytics for content risk
- [ ] A/B testing for moderation policies
- [ ] Advanced reporting and exports

## Contributing

1. Follow the existing code style and patterns
2. Add comprehensive tests for new features
3. Update documentation for API changes
4. Ensure all tests pass before submitting PR
5. Follow the project's security guidelines

## Support

For questions or issues with the moderation system:
- Check the API documentation
- Review the test cases for usage examples
- Contact the development team
- Submit issues through the project repository 