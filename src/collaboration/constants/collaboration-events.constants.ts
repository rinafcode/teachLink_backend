export const COLLABORATION_EVENTS = {
    // Inbound WebSocket messages
    JOIN_SESSION: 'join-session',
    COLLABORATIVE_OPERATION: 'collaborative-operation',
    REQUEST_SYNC: 'request-sync',
    RESOLVE_CONFLICT: 'resolve-conflict',
    // Outbound WebSocket messages
    USER_JOINED: 'user-joined',
    SESSION_STATE: 'session-state',
    OPERATION_APPLIED: 'operation-applied',
    FULL_SYNC: 'full-sync',
    CONFLICT_RESOLVED: 'conflict-resolved',
} as const;
export const NOTIFICATION_GATEWAY_EVENTS = {
    SUBSCRIBE: 'subscribe',
    NOTIFICATION: 'notification',
    BROADCAST_NOTIFICATION: 'broadcast_notification',
    SUBSCRIBE_NOTIFICATIONS: 'subscribe_notifications',
} as const;
export const MESSAGING_GATEWAY_EVENTS = {
    SEND_MESSAGE: 'send_message',
} as const;
