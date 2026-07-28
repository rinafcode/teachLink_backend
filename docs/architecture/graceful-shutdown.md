# Graceful Shutdown Protocol

Overview of signal handling (`SIGTERM`, `SIGINT`) and resource cleanup during application termination.

## 🔄 Shutdown Sequence
1. Stop accepting new incoming HTTP connections on the server instance.
2. Drain active background worker jobs from Redis queues within the allowed grace period (default: 10s).
3. Close active database connections and pool handles.
4. Exit application process with code `0`.