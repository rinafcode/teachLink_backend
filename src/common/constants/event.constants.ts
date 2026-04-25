export const APP_EVENTS = {
    // Data sync events
    DATA_UPDATED: 'data.updated',
    // Cache events
    CACHE_INVALIDATED: 'cache.invalidated',
    CACHE_PURGED: 'cache.purged',
    // Data integrity events
    DATA_CONSISTENCY_SCHEDULED: 'data.consistency.scheduled',
    DATA_INTEGRITY_VIOLATION: 'data.integrity.violation',
    // User events
    USER_SIGNUP: 'user.signup',
    USER_ADD_TAG: 'user.addTag',
    USER_REMOVE_TAG: 'user.removeTag',
    // Course events
    COURSE_ENROLLED: 'course.enrolled',
    COURSE_COMPLETED: 'course.completed',
    // Payment events
    PAYMENT_COMPLETED: 'payment.completed',
    // Segment events
    SEGMENT_ADD_USER: 'segment.addUser',
    // Notification events
    NOTIFICATION_SEND: 'notification.send',
    NOTIFICATION_TEMPLATE_SEND: 'notification.template.send',
} as const;
