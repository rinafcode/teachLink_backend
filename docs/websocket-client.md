# WebSocket Client Implementation Guide

TeachLink messaging uses Socket.io on the `messages` namespace with connection resilience built in.

## Connection URL

```
ws://<host>/messages?userId=<uuid>&lastSeq=<number>
```

- `userId` (required): authenticated user id
- `lastSeq` (optional): last message sequence received; server replays pending messages after reconnect

## Automatic Reconnection

Use exponential backoff when the socket disconnects:

```typescript
import { io, Socket } from 'socket.io-client';
import { calculateReconnectDelay } from '../src/common/utils/websocket.utils';

let attempt = 0;
let lastSeq = 0;

function connect(): Socket {
  const socket = io(`${API_URL}/messages`, {
    query: { userId, lastSeq: String(lastSeq) },
    transports: ['websocket'],
    reconnection: false,
  });

  socket.on('connect', () => {
    attempt = 0;
  });

  socket.on('disconnect', () => {
    const delay = calculateReconnectDelay(++attempt);
    setTimeout(() => connect(), delay);
  });

  socket.on('message', (payload) => {
    if (payload._seq) lastSeq = payload._seq;
    // handle message
  });

  socket.on('ping', () => socket.emit('pong'));
  socket.on('connected', (info) => console.log('session', info));

  return socket;
}
```

## Message Queue During Disconnection

While disconnected, the server queues outbound events per user. On reconnect with `lastSeq`, missed events are replayed with `_replayed: true`.

Client-side: buffer outbound `sendMessage` events locally until `connect`, then flush in order.

## Heartbeat

Server emits `ping` every 25s. Respond with `pong` or emit client `ping` and handle server `pong`.

## Backpressure

If the server queue exceeds ~90% capacity, new messages may be dropped server-side. Clients should throttle high-frequency events (e.g. typing) and show a warning when `backpressure` event is received (future).

## Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `sendMessage` | client → server | Send chat message |
| `message` | server → client | New message payload |
| `typing` | both | Typing indicator |
| `ping` / `pong` | both | Heartbeat |
| `connected` | server → client | Session established, includes `reconnectDelayMs` |
