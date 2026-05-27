# Developer Debugging Toolkit

In-process tools that make reproducing and diagnosing HTTP bugs fast, without
standing up an external APM. Everything is **ephemeral and process-local** — a
bounded in-memory ring buffer, never persisted.

## Capabilities

| Capability                  | Where                                        |
| --------------------------- | -------------------------------------------- |
| Request/response inspection | `RequestCaptureService` + `GET /debug/requests/:id` |
| Request replay (+ diff)     | `RequestReplayService` + `POST /debug/requests/:id/replay` |
| Performance timeline        | `PerformanceTimelineService` + `GET /debug/requests/:id/timeline` |
| Stack-trace enhancement     | `StackTraceService` + `GET /debug/requests/:id/trace` |

## How capture works

`DebugCaptureMiddleware` runs on every route (except `/debug/*`). For each
request it:

1. Assigns a `x-debug-id` and attaches a `TimelineRecorder` to `req.timeline`.
2. Patches `res.json`/`res.send` to buffer the response body.
3. On `finish`/`error`, builds the timeline, enhances any error, redacts
   sensitive headers, truncates oversized bodies and stores the record.

Downstream services can enrich the timeline:

```ts
await req.timeline?.measure('db.findCourses', () => repo.find());
```

## Enabling

The capture middleware mounts automatically when `NODE_ENV !== 'production'`.
Force it on elsewhere (e.g. staging) with `DEBUG_CAPTURE=true`. Replays target
the local instance by default; override with `DEBUG_REPLAY_BASE_URL` or the
`baseUrl` field in the replay body.

## API (admin only)

| Method & path                      | Description                              |
| ---------------------------------- | ---------------------------------------- |
| `GET /debug/requests`              | List recent exchanges (summaries)        |
| `GET /debug/requests/:id`          | Full captured request + response         |
| `GET /debug/requests/:id/timeline` | Timeline with slowest-span hotspots      |
| `GET /debug/requests/:id/trace`    | Enhanced structured stack trace          |
| `POST /debug/requests/:id/replay`  | Replay and diff against the original     |
| `DELETE /debug/requests`           | Clear the capture buffer                 |

All endpoints require an authenticated `ADMIN` because captured traffic can
contain sensitive payloads. Sensitive headers (`authorization`, `cookie`, …)
are redacted at capture time; supply fresh credentials via `headerOverrides`
when replaying.

## Wiring

Import `DebuggingModule` into `AppModule`:

```ts
@Module({ imports: [DebuggingModule] })
export class AppModule {}
```
