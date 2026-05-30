# feat: Segment SDK integration for unified analytics

## Summary

Integrates the [Segment Node.js SDK](https://segment.com/docs/connections/sources/catalog/libraries/server/node/) (`@segment/analytics-node`) into the TeachLink backend to provide unified analytics event tracking, user identification, and destination configuration management.

## Changes

### New files

| File | Description |
|---|---|
| `src/analytics/segment/segment.service.ts` | Core service — wraps Segment SDK, exposes `track()` and `identify()`, flushes on graceful shutdown |
| `src/analytics/segment/segment-destination-config.entity.ts` | TypeORM entity persisting destination name, enabled flag, and JSON settings |
| `src/analytics/segment/segment.dto.ts` | Validated DTOs: `TrackEventDto`, `IdentifyUserDto`, `CreateDestinationConfigDto`, `UpdateDestinationConfigDto` |
| `src/analytics/segment/segment.controller.ts` | REST controller for event tracking and destination config CRUD |
| `src/analytics/segment/segment.module.ts` | NestJS module wiring the above together |
| `src/analytics/segment/segment.service.spec.ts` | Unit tests (8 passing) |

### Modified files

| File | Change |
|---|---|
| `src/analytics/analytics.module.ts` | Imports and exports `SegmentModule` |
| `src/config/env.validation.ts` | Adds optional `SEGMENT_WRITE_KEY` env var |
| `package.json` / `package-lock.json` | Adds `@segment/analytics-node@2.1.2` |

## API endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/analytics/segment/track` | Track an analytics event |
| `POST` | `/analytics/segment/identify` | Identify a user with traits |
| `POST` | `/analytics/segment/destinations` | Create a destination configuration |
| `GET` | `/analytics/segment/destinations` | List all destination configurations |
| `GET` | `/analytics/segment/destinations/:id` | Get a destination configuration |
| `PATCH` | `/analytics/segment/destinations/:id` | Update a destination configuration |
| `DELETE` | `/analytics/segment/destinations/:id` | Delete a destination configuration |

## Configuration

Add to `.env`:

```env
SEGMENT_WRITE_KEY=your_segment_write_key
```

`SEGMENT_WRITE_KEY` is optional. When absent, the service logs a warning and all calls are no-ops — the app boots normally without Segment configured.

## Testing

- 8 unit tests covering: `track`, `identify`, `anonymousId` forwarding, graceful flush on shutdown, and no-op behaviour when write key is absent.
- TypeScript type-check passes for all new files.

## Acceptance criteria

- [x] Segment SDK integration
- [x] Event tracking to Segment
- [x] User identification
- [x] Destination configuration UI (REST API)
closes [#596](https://github.com/rinafcode/teachLink_backend/issues/596)
