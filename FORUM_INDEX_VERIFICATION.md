# Forum Index Verification - Query Plans Before & After

This document provides SQL queries for capturing `EXPLAIN ANALYZE` output to verify the performance improvement from the forum indexes.

## Prerequisites

1. Connect to your PostgreSQL database
2. Ensure you have forum data populated (threads, comments, votes)
3. Run the queries BEFORE applying the migration to capture baseline
4. Apply the migration: `npm run migration:run`
5. Run the queries AFTER applying the migration to capture improvements

## Query 1: getThreads() - Filter by status and order by createdAt

**Service Method:** `ForumService.getThreads()`

**Query Code:**
```typescript
this.threadRepo.find({ 
  where: { status: 'active' }, 
  order: { createdAt: 'DESC' } 
})
```

**SQL to Test:**
```sql
EXPLAIN ANALYZE
  SELECT * FROM forum_threads
   WHERE status = 'active'
   ORDER BY "createdAt" DESC;
```

**Expected Before:**
```
Seq Scan on forum_threads (cost=... rows=... width=...)
  Filter: (status = 'active')
Planning Time: ...
Execution Time: ...
```

**Expected After:**
```
Index Scan using IDX_forum_threads_status_createdAt on forum_threads (cost=... rows=... width=...)
  Index Cond: (status = 'active')
Planning Time: ...
Execution Time: ... (should be significantly lower)
```

---

## Query 2: getThread() - Load comments by threadId

**Service Method:** `ForumService.getThread(id)` with `relations: ['comments']`

**Query Code:**
```typescript
this.threadRepo.findOne({ 
  where: { id, status: 'active' }, 
  relations: ['comments'] 
})
```

The `relations: ['comments']` triggers an automatic query to load comments:

**SQL to Test:**
```sql
EXPLAIN ANALYZE
  SELECT * FROM forum_comments
   WHERE "threadId" = '<replace-with-actual-thread-uuid>'
   ORDER BY "createdAt" ASC;
```

**Expected Before:**
```
Seq Scan on forum_comments (cost=... rows=... width=...)
  Filter: (threadId = '<uuid>')
  Sort: ...
Planning Time: ...
Execution Time: ...
```

**Expected After:**
```
Index Scan using IDX_forum_comments_threadId_createdAt on forum_comments (cost=... rows=... width=...)
  Index Cond: (threadId = '<uuid>')
Planning Time: ...
Execution Time: ... (should be significantly lower)
```

---

## Query 3: vote() - Check for existing vote

**Service Method:** `ForumService.vote()` - Vote lookup

**Query Code:**
```typescript
this.voteRepo.findOne({ 
  where: { entityType, entityId, authorId } 
})
```

**SQL to Test:**
```sql
EXPLAIN ANALYZE
  SELECT * FROM forum_votes
   WHERE "entityType" = 'thread'
     AND "entityId" = '<replace-with-actual-uuid>'
     AND "authorId" = '<replace-with-actual-user-uuid>';
```

**Expected Before:**
```
Index Scan using UQ_<hash>_entityType_entityId_authorId on forum_votes (cost=... rows=... width=...)
  Index Cond: ((entityType = 'thread') AND (entityId = '<uuid>') AND (authorId = '<uuid>'))
```

**Expected After:**
```
(Same as before - this query was already indexed via the unique constraint)
Index Scan using UQ_<hash>_entityType_entityId_authorId on forum_votes (cost=... rows=... width=...)
  Index Cond: ((entityType = 'thread') AND (entityId = '<uuid>') AND (authorId = '<uuid>'))
```

**Note:** This query was already efficient due to the `@Unique(['entityType', 'entityId', 'authorId'])` constraint creating an implicit unique index.

---

## Query 4: updateVoteTotals() - Count upvotes

**Service Method:** `ForumService.updateVoteTotals()`

**Query Code:**
```typescript
this.voteRepo.count({ 
  where: { entityType, entityId, value: 1 } 
})
```

**SQL to Test:**
```sql
EXPLAIN ANALYZE
  SELECT COUNT(*) FROM forum_votes
   WHERE "entityType" = 'thread'
     AND "entityId" = '<replace-with-actual-uuid>'
     AND value = 1;
```

**Expected Before:**
```
Aggregate (cost=... rows=1 width=8)
  -> Seq Scan on forum_votes (cost=... rows=... width=0)
        Filter: ((entityType = 'thread') AND (entityId = '<uuid>') AND (value = 1))
Planning Time: ...
Execution Time: ...
```

**Expected After:**
```
Aggregate (cost=... rows=1 width=8)
  -> Index Scan using IDX_forum_votes_entityType_entityId on forum_votes (cost=... rows=... width=0)
        Index Cond: ((entityType = 'thread') AND (entityId = '<uuid>'))
        Filter: (value = 1)
Planning Time: ...
Execution Time: ... (should be significantly lower)
```

---

## Query 5: updateVoteTotals() - Count downvotes

**Service Method:** `ForumService.updateVoteTotals()`

**Query Code:**
```typescript
this.voteRepo.count({ 
  where: { entityType, entityId, value: -1 } 
})
```

**SQL to Test:**
```sql
EXPLAIN ANALYZE
  SELECT COUNT(*) FROM forum_votes
   WHERE "entityType" = 'thread'
     AND "entityId" = '<replace-with-actual-uuid>'
     AND value = -1;
```

**Expected Before:**
```
Aggregate (cost=... rows=1 width=8)
  -> Seq Scan on forum_votes (cost=... rows=... width=0)
        Filter: ((entityType = 'thread') AND (entityId = '<uuid>') AND (value = -1))
Planning Time: ...
Execution Time: ...
```

**Expected After:**
```
Aggregate (cost=... rows=1 width=8)
  -> Index Scan using IDX_forum_votes_entityType_entityId on forum_votes (cost=... rows=... width=0)
        Index Cond: ((entityType = 'thread') AND (entityId = '<uuid>'))
        Filter: (value = -1)
Planning Time: ...
Execution Time: ... (should be significantly lower)
```

---

## Bonus Query: Nested Comments by parentId

**Future Query Pattern:** Loading nested replies

**SQL to Test:**
```sql
EXPLAIN ANALYZE
  SELECT * FROM forum_comments
   WHERE "parentId" = '<replace-with-actual-comment-uuid>'
   ORDER BY "createdAt" ASC;
```

**Expected Before:**
```
Seq Scan on forum_comments (cost=... rows=... width=...)
  Filter: (parentId = '<uuid>')
Planning Time: ...
Execution Time: ...
```

**Expected After:**
```
Index Scan using IDX_forum_comments_parentId on forum_comments (cost=... rows=... width=...)
  Index Cond: (parentId = '<uuid>')
Planning Time: ...
Execution Time: ... (should be significantly lower)
```

---

## Summary

### Indexes Added

1. **`IDX_forum_threads_status_createdAt`** on `forum_threads(status, createdAt)`
   - Supports: Thread listing filtered by status, ordered by date

2. **`IDX_forum_comments_threadId_createdAt`** on `forum_comments(threadId, createdAt)`
   - Supports: Loading all comments for a thread, ordered chronologically

3. **`IDX_forum_comments_parentId`** on `forum_comments(parentId)`
   - Supports: Loading nested comment replies

4. **`IDX_forum_votes_entityType_entityId`** on `forum_votes(entityType, entityId)`
   - Supports: Counting total votes, upvotes, and downvotes for any entity

### Performance Impact

- **Before:** All queries (except vote lookup) perform sequential scans
- **After:** All queries use index scans with O(log n) lookup time
- **Expected Improvement:** 10-100x faster depending on table size

### Testing Checklist

- [ ] Captured "before" query plans for all 5 queries
- [ ] Applied migration: `npm run migration:run`
- [ ] Verified indexes exist: `\d forum_threads`, `\d forum_comments`, `\d forum_votes`
- [ ] Captured "after" query plans for all 5 queries
- [ ] Confirmed no `Seq Scan` appears in any query plan
- [ ] Documented results in PR description
