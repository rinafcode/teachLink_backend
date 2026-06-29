# Achievement System

A comprehensive achievement and progression tracking system for TeachLink that allows users to unlock achievements, track progress, and compete on leaderboards.

## Features

### 1. **Achievement Definition System**
- Create and manage achievement definitions with various types and difficulties
- Support for multiple achievement types: Milestone, Challenge, Streaks, Skill-based, Engagement, Contribution
- Difficulty levels: Easy, Medium, Hard, Legendary
- Flexible criteria configuration for different achievement conditions
- Points and experience rewards per achievement

### 2. **Progress Tracking**
- Track user progress toward achievements with incremental progress
- Automatic unlock when targets are reached
- Percentage-based progress visualization
- Metadata support for additional context
- Progress history and last update tracking

### 3. **Achievement Notifications**
- Automatic notifications when achievements are unlocked
- Points and XP earned information
- Customizable notification messages
- Failed notification retry mechanisms

### 4. **Statistics and Analytics**
- Achievement unlock rates and trends
- User achievement leaderboards
- Achievement overview per user
- Daily statistics collection
- Engagement trend analysis
- Average time to unlock calculations

## Database Schema

### Entities

#### `Achievement`
Main achievement definition entity.

```typescript
{
  id: UUID
  name: string
  description: string
  longDescription?: string
  iconUrl: string
  type: 'milestone' | 'challenge' | 'streaks' | 'skill_based' | 'engagement' | 'contribution'
  difficulty: 'easy' | 'medium' | 'hard' | 'legendary'
  pointsReward: number
  experienceReward: number
  criteria: JSONB // { type: string, target: number, ... }
  progressConfig: JSONB // { trackingType: string, maxProgress: number }
  isActive: boolean
  isHidden: boolean
  unlockedBy: number // Count of users who unlocked
  createdAt: timestamp
  updatedAt: timestamp
}
```

#### `AchievementProgress`
Tracks a user's progress toward an achievement.

```typescript
{
  id: UUID
  userId: UUID
  achievementId: UUID
  currentProgress: number
  targetProgress: number
  percentageComplete: number (0-100)
  isUnlocked: boolean
  lastProgressUpdate?: timestamp
  metadata?: JSONB
  createdAt: timestamp
  updatedAt: timestamp
}
```

#### `UserAchievement`
Records when a user unlocks an achievement.

```typescript
{
  id: UUID
  userId: UUID
  achievementId: UUID
  unlockedAt: timestamp
  unlockedMetadata?: JSONB
  pointsEarned: number
  experienceEarned: number
  notificationSent: boolean
  isHidden: boolean
  createdAt: timestamp
  updatedAt: timestamp
}
```

#### `AchievementStatistics`
Daily statistics for achievements.

```typescript
{
  id: UUID
  achievementId: UUID
  date: date
  totalUnlocked: number
  unlockedToday: number
  unlockedPercentage: number
  averageTimeToUnlock?: number (days)
  activeTrackers: number
  averageProgress: number
  engagementTrend?: 'positive' | 'negative' | 'stable'
  metadata?: JSONB
  createdAt: timestamp
  updatedAt: timestamp
}
```

## API Endpoints

### Achievement Management

#### Create Achievement
```
POST /achievements
Body: {
  name: string
  description: string
  longDescription?: string
  iconUrl: string
  type: AchievementType
  difficulty: AchievementDifficulty
  pointsReward: number
  experienceReward: number
  criteria: object
  progressConfig: object
}
Response: AchievementResponseDto
```

#### Get All Achievements
```
GET /achievements?includeHidden=false
Response: AchievementResponseDto[]
```

#### Get Achievement by ID
```
GET /achievements/:achievementId
Response: AchievementResponseDto
```

#### Get Achievements by Type
```
GET /achievements/type/:type
Response: AchievementResponseDto[]
```

#### Update Achievement
```
PUT /achievements/:achievementId
Body: Partial<AchievementUpdateDto>
Response: AchievementResponseDto
```

#### Deactivate Achievement
```
DELETE /achievements/:achievementId
Response: 204 No Content
```

### Progress Tracking

#### Initialize Progress
```
POST /achievements/:achievementId/progress/:userId
Response: AchievementProgressDto
```

#### Get User Progress for Achievement
```
GET /achievements/:achievementId/progress/:userId
Response: AchievementProgressDto
```

#### Update Progress
```
PUT /achievements/:achievementId/progress/:userId
Body: {
  currentProgress: number
  metadata?: object
}
Response: AchievementProgressDto
```

#### Increment Progress
```
POST /achievements/:achievementId/progress/:userId/increment
Body: {
  incrementBy?: number (default: 1)
  metadata?: object
}
Response: AchievementProgressDto
```

#### Get All User Progress
```
GET /achievements/progress/:userId
Response: AchievementProgressDto[]
```

### Achievement Unlocking

#### Unlock Achievement
```
POST /achievements/:achievementId/unlock/:userId
Body?: { metadata?: object }
Response: AchievementUnlockedEventDto
```

#### Get User Achievements
```
GET /achievements/user/:userId/unlocked
Response: UserAchievementDto[]
```

#### Check If User Has Achievement
```
GET /achievements/:achievementId/user/:userId/has
Response: { hasAchievement: boolean }
```

#### Get User Achievement Count
```
GET /achievements/user/:userId/count
Response: { count: number }
```

#### Batch Unlock Achievements
```
POST /achievements/batch-unlock/:userId
Body: { achievementIds: string[] }
Response: AchievementUnlockedEventDto[]
```

### Statistics & Analytics

#### Get Achievement Statistics
```
GET /achievements/:achievementId/statistics
Response: AchievementStatisticsDto
```

#### Get User Achievement Overview
```
GET /achievements/user/:userId/overview
Response: AchievementOverviewDto
{
  totalAchievements: number
  unlockedAchievements: number
  progressPercentage: number
  totalPointsEarned: number
  totalExperienceEarned: number
  userRank: number
}
```

#### Get Achievements Leaderboard
```
GET /achievements/leaderboard?limit=10
Response: AchievementLeaderboardDto[]
```

#### Get All Statistics
```
GET /achievements/statistics/all
Response: AchievementStatisticsDto[]
```

## Usage Examples

### Creating an Achievement

```typescript
const achievement = await achievementsService.createAchievement({
  name: 'Course Master',
  description: 'Complete 10 courses',
  longDescription: 'Demonstrates dedication to learning',
  iconUrl: 'https://example.com/icons/course-master.png',
  type: AchievementType.MILESTONE,
  difficulty: AchievementDifficulty.HARD,
  pointsReward: 500,
  experienceReward: 250,
  criteria: {
    type: 'COURSES_COMPLETED',
    target: 10
  },
  progressConfig: {
    trackingType: 'incremental',
    maxProgress: 10
  }
});
```

### Tracking Progress

```typescript
// Initialize progress tracking
await achievementsService.initializeProgress(userId, achievementId);

// Increment progress (e.g., when course is completed)
await achievementsService.incrementProgress(userId, achievementId, 1, {
  courseId: 'course-123',
  courseName: 'Advanced TypeScript'
});

// Get progress
const progress = await achievementsService.getUserProgressForAchievement(userId, achievementId);
console.log(`Progress: ${progress.percentageComplete}%`);
```

### Unlocking Achievements

```typescript
// Manual unlock
const unlockedEvent = await achievementsService.unlockAchievement(userId, achievementId, {
  reason: 'course_completion',
  courseId: 'course-123'
});

console.log(`Earned ${unlockedEvent.pointsEarned} points!`);

// Check if user has achievement
const hasAchievement = await achievementsService.hasAchievement(userId, achievementId);
```

### Getting Statistics

```typescript
// User overview
const overview = await achievementsService.getUserAchievementOverview(userId);
console.log(`User has unlocked ${overview.unlockedAchievements} of ${overview.totalAchievements} achievements`);

// Leaderboard
const leaderboard = await achievementsService.getAchievementsLeaderboard(10);
console.log('Top achievement unlocking users:', leaderboard);

// Achievement statistics
const stats = await achievementsService.getAchievementStatistics(achievementId);
console.log(`${stats.totalUnlocked} users have this achievement`);
```

## Integration Points

### With Notifications
The achievements system is designed to integrate with the existing notifications module. When an achievement is unlocked, a notification is automatically created.

### With User Progression
Achievements track user progression and contribute to overall user engagement metrics.

### With Gamification
Works alongside the existing gamification module for badges and points.

## Testing

Run tests with:
```bash
npm run test -- src/achievements
```

Test coverage includes:
- Achievement CRUD operations
- Progress tracking logic
- Auto-unlock functionality
- Statistics calculations
- Leaderboard generation

## Best Practices

1. **Define Clear Criteria**: Make sure achievement criteria are unambiguous and measurable
2. **Balance Difficulty**: Mix easy, medium, hard, and legendary achievements
3. **Regular Cleanup**: Deactivate outdated achievements instead of deleting them
4. **Monitor Stats**: Use statistics to identify if achievements are well-tuned
5. **Reward Appropriately**: Align points/XP rewards with achievement difficulty
6. **Use Metadata**: Store context about how achievements are earned for analytics

## Future Enhancements

- [ ] Achievement categories and sub-categories
- [ ] Time-limited/seasonal achievements
- [ ] Achievement cascades (unlock achievement A to unlock B)
- [ ] Team/group achievements
- [ ] Achievement badges with tiers
- [ ] Notifications integration with email/push
- [ ] Achievement recommendations
- [ ] Custom achievement editor UI
