# PR Description: Pagination in AchievementsService (#1020)

## Overview
This PR addresses the unbounded reads in `AchievementsService`. Methods that used to retrieve the entire sets of achievements or user progress now accept pagination parameters and perform bounded queries to avoid loading large lists into memory. Additionally, the achievement definition set is now cached and `getUserAchievementOverview` performs an aggregated query instead of retrieving arrays into memory to calculate totals.

## Changes Made
- Added pagination parameters (`query?: PaginationQueryDto`) to `getAllAchievements`, `getAchievementsByType`, `getUserAllProgress`, and `getUserAchievements`.
- Updated these methods to return `OffsetPaginatedResponse` using `buildOffsetResponse`, and implemented `skip`/`take` logic in TypeORM queries.
- Injected `CacheManager` to cache `total_achievements` and invalidated the cache (`achievements_definitions`) on mutations (`createAchievement`, `updateAchievement`, `deactivateAchievement`).
- Refactored `getUserAchievementOverview` to replace lines 472-476 (loading all active achievements and all user achievements into arrays). It now uses `CacheManager` for `totalAchievements` and a single `createQueryBuilder` aggregation to calculate `unlockedCount`, `totalPoints`, and `totalExperience`.
- Ensured indexes exist on `userId` within the progress tracking components for optimization.

## Acceptance Criteria
- [x] All achievement list endpoints return bounded pages.
- [x] Definition reads are served from cache between mutations.
- [x] The definitions-plus-progress path issues one query rather than two full reads.
- [x] User-scoped achievement lookups are index-backed.
