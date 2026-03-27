# Email Notification System

## Overview

This module provides email sending functionality for user verification and password reset using Nodemailer, Handlebars templates, and Bull queue for async processing.

## Features

- ✅ Email verification
- ✅ Password reset emails
- ✅ Async email queue with Bull
- ✅ Retry logic with exponential backoff
- ✅ HTML email templates with Handlebars
- ✅ Email delivery monitoring and logging
- ✅ Graceful error handling

## Architecture

```
notifications/
├── email/
│   ├── email.service.ts          # Core email sending logic
│   ├── email.processor.ts        # Bull queue processor
│   └── templates/
│       ├── verification.hbs      # Email verification template
│       └── reset-password.hbs    # Password reset template
├── notifications.service.ts      # High-level notification service
└── notifications.module.ts       # Module configuration
```

## Configuration

Add these environment variables to your `.env` file:

```env
# SMTP Configuration
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
EMAIL_FROM=noreply@teachlink.io
EMAIL_FROM_NAME=TeachLink

# Application URL
APP_URL=http://localhost:3000
```

## Usage

### In Auth Service

```typescript
// Send verification email
await this.notificationsService.sendVerificationEmail(user.email, verificationToken);

// Send password reset email
await this.notificationsService.sendPasswordResetEmail(user.email, resetToken);
```

## Email Templates

Templates are located in `src/notifications/email/templates/` and use Handlebars syntax.

### Available Templates

1. **verification.hbs** - Email verification
   - Variables: `verificationUrl`, `appUrl`

2. **reset-password.hbs** - Password reset
   - Variables: `resetUrl`, `appUrl`

### Adding New Templates

1. Create a new `.hbs` file in `templates/`
2. Use Handlebars syntax for variables: `{{variableName}}`
3. Call `emailService.sendEmail()` with template name and context

## Queue Processing

Emails are processed asynchronously using Bull queue:

- Queue name: `email`
- Retry attempts: 3
- Backoff strategy: Exponential (2s initial delay)
- Redis connection: Shared with other Bull queues

## Monitoring

Email delivery is logged at multiple levels:

- **Info**: Email queued, sent successfully
- **Error**: Failed to send, with stack trace

Monitor queue health via Bull dashboard or Redis CLI:

```bash
# Check queue status
redis-cli LLEN bull:email:wait
redis-cli LLEN bull:email:active
redis-cli LLEN bull:email:failed
```

## Testing

### Test SMTP Connection

```typescript
const isConnected = await emailService.verifyConnection();
console.log('SMTP connection:', isConnected);
```

### Using Mailtrap for Development

1. Sign up at [mailtrap.io](https://mailtrap.io)
2. Get SMTP credentials from your inbox
3. Update `.env` with Mailtrap credentials
4. All emails will be caught in Mailtrap inbox

## Error Handling

The system handles failures gracefully:

1. **Queue Level**: Automatic retry with exponential backoff
2. **Service Level**: Errors logged with context
3. **Application Level**: User receives generic success message (security)

## Security Considerations

- Tokens expire (24h for verification, 1h for password reset)
- Email addresses not revealed in error messages
- SMTP credentials stored in environment variables
- TLS/SSL support via `SMTP_SECURE` flag

## Production Recommendations

1. Use a reliable SMTP provider (SendGrid, AWS SES, Mailgun)
2. Enable `SMTP_SECURE=true` for TLS
3. Monitor queue metrics and failed jobs
4. Set up dead letter queue for failed emails
5. Implement rate limiting for email sending
6. Add email templates for other notifications (welcome, course enrollment, etc.)
