# Payments API Documentation

Complete documentation for TeachLink payment processing endpoints.

## Table of Contents
- [Create Payment Intent](#create-payment-intent)
- [Create Subscription](#create-subscription)
- [Process Refund](#process-refund)
- [Get Invoice](#get-invoice)
- [Get Payment History](#get-payment-history)
- [Get User Subscriptions](#get-user-subscriptions)

---

## Create Payment Intent

Create a payment intent for course purchase.

### Endpoint
```
POST /payments/create-intent
```

### Authentication
**Required**: Bearer Token  
**Role**: `STUDENT` or `TEACHER`

### Idempotency
**Required**: `X-Idempotency-Key` header  
This endpoint is idempotent - safe to retry with the same key.

### Headers

```
Authorization: Bearer <access-token>
Content-Type: application/json
X-Idempotency-Key: unique-key-123456
```

### Request Body

**Content-Type**: `application/json`

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| courseId | string | Yes | Course ID to purchase | Valid course UUID |
| amount | number | Yes | Payment amount in cents | Positive integer |
| currency | string | No | Currency code | ISO 4217 (default: `USD`) |
| paymentMethod | string | Yes | Payment method | `CARD`, `PAYPAL`, `CRYPTO` |
| metadata | object | No | Additional metadata | Key-value pairs |

### Example Request

```bash
curl -X POST http://localhost:3000/payments/create-intent \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: unique-key-123456" \
  -d '{
    "courseId": "course-123456",
    "amount": 4999,
    "currency": "USD",
    "paymentMethod": "CARD",
    "metadata": {
      "promoCode": "SAVE20"
    }
  }'
```

### Example Response

**Success (201 Created)**

```json
{
  "success": true,
  "message": "Payment intent created successfully",
  "data": {
    "paymentIntentId": "pi_1234567890",
    "clientSecret": "pi_1234567890_secret_abcdefgh",
    "amount": 4999,
    "currency": "USD",
    "status": "requires_payment_method",
    "courseId": "course-123456",
    "expiresAt": "2024-01-20T17:00:00.000Z"
  }
}
```

**Error (400 Bad Request)**

```json
{
  "success": false,
  "message": "Invalid payment amount",
  "errors": [
    {
      "field": "amount",
      "message": "Amount must be a positive integer"
    }
  ]
}
```

**Error (409 Conflict)**

```json
{
  "success": false,
  "message": "You are already enrolled in this course",
  "errors": []
}
```

### Idempotency Key

Generate a unique UUID for each payment attempt:

```javascript
// Generate idempotency key
const idempotencyKey = require('crypto').randomUUID();

// Use the same key for retries
// If the request fails, retry with the same key to prevent duplicate charges
```

---

## Create Subscription

Create a subscription for premium courses or platform access.

### Endpoint
```
POST /payments/subscriptions
```

### Authentication
**Required**: Bearer Token  
**Role**: `STUDENT` or `TEACHER`

### Idempotency
**Required**: `X-Idempotency-Key` header

### Headers

```
Authorization: Bearer <access-token>
Content-Type: application/json
X-Idempotency-Key: unique-key-789012
```

### Request Body

**Content-Type**: `application/json`

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| planId | string | Yes | Subscription plan ID | Valid plan ID |
| paymentMethod | string | Yes | Payment method | `CARD`, `PAYPAL` |
| billingCycle | string | No | Billing frequency | `MONTHLY`, `YEARLY` (default: `MONTHLY`) |
| couponCode | string | No | Discount coupon | Valid coupon code |

### Subscription Plans

| Plan ID | Name | Monthly Price | Yearly Price | Features |
|---------|------|---------------|--------------|----------|
| `basic` | Basic | $9.99/mo | $99.99/yr | Access to basic courses |
| `pro` | Professional | $29.99/mo | $299.99/yr | All courses + certificates |
| `enterprise` | Enterprise | $99.99/mo | $999.99/yr | Team management + analytics |

### Example Request

```bash
curl -X POST http://localhost:3000/payments/subscriptions \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: unique-key-789012" \
  -d '{
    "planId": "pro",
    "paymentMethod": "CARD",
    "billingCycle": "YEARLY",
    "couponCode": "NEWYEAR20"
  }'
```

### Example Response

**Success (201 Created)**

```json
{
  "success": true,
  "message": "Subscription created successfully",
  "data": {
    "subscriptionId": "sub_1234567890",
    "planId": "pro",
    "planName": "Professional",
    "status": "active",
    "billingCycle": "YEARLY",
    "amount": 29999,
    "currency": "USD",
    "discount": 5999,
    "finalAmount": 23999,
    "currentPeriodStart": "2024-01-20T00:00:00.000Z",
    "currentPeriodEnd": "2025-01-20T00:00:00.000Z",
    "nextBillingDate": "2025-01-20T00:00:00.000Z",
    "cancelAtPeriodEnd": false
  }
}
```

**Error (400 Bad Request)**

```json
{
  "success": false,
  "message": "Invalid coupon code",
  "errors": []
}
```

---

## Process Refund

Process a refund for a payment (Admins and Teachers only).

### Endpoint
```
POST /payments/refund
```

### Authentication
**Required**: Bearer Token  
**Role**: `ADMIN` or `TEACHER`

### Idempotency
**Required**: `X-Idempotency-Key` header

### Headers

```
Authorization: Bearer <access-token>
Content-Type: application/json
X-Idempotency-Key: unique-key-345678
```

### Request Body

**Content-Type**: `application/json`

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| paymentId | string | Yes | Original payment ID | Valid payment UUID |
| amount | number | No | Refund amount in cents | ≤ original amount |
| reason | string | Yes | Refund reason | 10-500 characters |

### Example Request

```bash
curl -X POST http://localhost:3000/payments/refund \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: unique-key-345678" \
  -d '{
    "paymentId": "payment-123456",
    "amount": 4999,
    "reason": "Course did not meet expectations"
  }'
```

### Example Response

**Success (200 OK)**

```json
{
  "success": true,
  "message": "Refund processed successfully",
  "data": {
    "refundId": "re_1234567890",
    "paymentId": "payment-123456",
    "amount": 4999,
    "currency": "USD",
    "status": "succeeded",
    "reason": "Course did not meet expectations",
    "processedAt": "2024-01-20T15:30:00.000Z",
    "estimatedArrival": "2024-01-27T00:00:00.000Z"
  }
}
```

**Error (400 Bad Request)**

```json
{
  "success": false,
  "message": "Refund amount exceeds original payment",
  "errors": []
}
```

**Error (404 Not Found)**

```json
{
  "success": false,
  "message": "Payment not found",
  "errors": []
}
```

### Refund Policies

- **Full refund**: Within 30 days of purchase
- **Partial refund**: After 30 days (at instructor discretion)
- **Processing time**: 5-10 business days
- **Minimum amount**: $1.00 USD

---

## Get Invoice

Retrieve invoice for a specific payment.

### Endpoint
```
GET /payments/invoices/:paymentId
```

### Authentication
**Required**: Bearer Token  
**Role**: `STUDENT`, `TEACHER`, or `ADMIN`

### Headers

```
Authorization: Bearer <access-token>
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| paymentId | string | Yes | Payment ID |

### Example Request

```bash
curl http://localhost:3000/payments/invoices/payment-123456 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Example Response

**Success (200 OK)**

```json
{
  "success": true,
  "data": {
    "invoiceId": "inv_1234567890",
    "invoiceNumber": "INV-2024-001234",
    "paymentId": "payment-123456",
    "userId": "user-789012",
    "userName": "John Doe",
    "userEmail": "john.doe@example.com",
    "amount": 4999,
    "currency": "USD",
    "tax": 450,
    "total": 5449,
    "status": "paid",
    "items": [
      {
        "description": "Complete Web Development Bootcamp",
        "quantity": 1,
        "unitPrice": 4999,
        "total": 4999
      }
    ],
    "issuedAt": "2024-01-20T10:00:00.000Z",
    "paidAt": "2024-01-20T10:05:00.000Z",
    "downloadUrl": "https://api.teachlink.com/payments/invoices/payment-123456/download"
  }
}
```

**Error (404 Not Found)**

```json
{
  "success": false,
  "message": "Invoice not found",
  "errors": []
}
```

### Download Invoice PDF

```bash
curl http://localhost:3000/payments/invoices/payment-123456/download \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  --output invoice.pdf
```

---

## Get Payment History

Retrieve user's payment history.

### Endpoint
```
GET /payments/user/payments
```

### Authentication
**Required**: Bearer Token  
**Role**: `STUDENT`, `TEACHER`, or `ADMIN`

### Headers

```
Authorization: Bearer <access-token>
```

### Query Parameters

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| limit | number | No | Items per page | 10 |
| page | number | No | Page number | 1 |
| status | string | No | Filter by status | All |
| startDate | date | No | Filter from date | - |
| endDate | date | No | Filter to date | - |

### Status Values

- `pending` - Payment initiated
- `succeeded` - Payment completed
- `failed` - Payment failed
- `refunded` - Payment refunded
- `partially_refunded` - Partial refund issued

### Example Request

```bash
curl "http://localhost:3000/payments/user/payments?limit=10&page=1&status=succeeded" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Example Response

**Success (200 OK)**

```json
{
  "success": true,
  "data": [
    {
      "paymentId": "payment-123456",
      "invoiceNumber": "INV-2024-001234",
      "amount": 4999,
      "currency": "USD",
      "status": "succeeded",
      "paymentMethod": "CARD",
      "description": "Complete Web Development Bootcamp",
      "type": "course_purchase",
      "createdAt": "2024-01-20T10:00:00.000Z",
      "completedAt": "2024-01-20T10:05:00.000Z"
    },
    {
      "paymentId": "payment-123455",
      "invoiceNumber": "INV-2024-001233",
      "amount": 2999,
      "currency": "USD",
      "status": "succeeded",
      "paymentMethod": "PAYPAL",
      "description": "Monthly Subscription - Professional",
      "type": "subscription",
      "createdAt": "2024-01-15T08:30:00.000Z",
      "completedAt": "2024-01-15T08:35:00.000Z"
    }
  ],
  "meta": {
    "total": 25,
    "page": 1,
    "limit": 10,
    "totalPages": 3
  }
}
```

---

## Get User Subscriptions

Retrieve user's active and past subscriptions.

### Endpoint
```
GET /payments/user/subscriptions
```

### Authentication
**Required**: Bearer Token  
**Role**: `STUDENT`, `TEACHER`, or `ADMIN`

### Headers

```
Authorization: Bearer <access-token>
```

### Example Request

```bash
curl http://localhost:3000/payments/user/subscriptions \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Example Response

**Success (200 OK)**

```json
{
  "success": true,
  "data": [
    {
      "subscriptionId": "sub_1234567890",
      "planId": "pro",
      "planName": "Professional",
      "status": "active",
      "billingCycle": "YEARLY",
      "amount": 29999,
      "currency": "USD",
      "currentPeriodStart": "2024-01-20T00:00:00.000Z",
      "currentPeriodEnd": "2025-01-20T00:00:00.000Z",
      "nextBillingDate": "2025-01-20T00:00:00.000Z",
      "cancelAtPeriodEnd": false,
      "features": [
        "Access to all courses",
        "Certificates of completion",
        "Priority support",
        "Offline downloads"
      ],
      "createdAt": "2024-01-20T00:00:00.000Z"
    }
  ]
}
```

---

## Payment Methods

### Supported Payment Methods

| Method | Description | Processing Time | Fees |
|--------|-------------|-----------------|------|
| `CARD` | Credit/Debit cards | Instant | 2.9% + $0.30 |
| `PAYPAL` | PayPal account | Instant | 3.49% + $0.49 |
| `CRYPTO` | Cryptocurrency | 10-30 min | 1% |

### Accepted Cards

- Visa
- Mastercard
- American Express
- Discover

---

## Webhook Events

Payment webhooks notify your system of payment events:

### Event Types

| Event | Description |
|-------|-------------|
| `payment.succeeded` | Payment completed successfully |
| `payment.failed` | Payment failed |
| `payment.refunded` | Payment refunded |
| `subscription.created` | New subscription created |
| `subscription.renewed` | Subscription renewed |
| `subscription.cancelled` | Subscription cancelled |
| `subscription.expired` | Subscription expired |

### Webhook Payload Example

```json
{
  "eventId": "evt_123456",
  "eventType": "payment.succeeded",
  "timestamp": "2024-01-20T10:05:00.000Z",
  "data": {
    "paymentId": "payment-123456",
    "amount": 4999,
    "currency": "USD",
    "userId": "user-789012",
    "courseId": "course-123456"
  }
}
```

### Webhook Signature Verification

```javascript
// Verify webhook signature
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return signature === expected;
}
```

---

## Security Best Practices

### 1. Idempotency

Always use idempotency keys for payment requests:

```javascript
// Generate unique key per payment attempt
const idempotencyKey = crypto.randomUUID();

// Store key and retry if needed
async function createPayment(paymentData) {
  try {
    return await fetch('/payments/create-intent', {
      method: 'POST',
      headers: {
        'X-Idempotency-Key': idempotencyKey,
        // ... other headers
      },
      body: JSON.stringify(paymentData)
    });
  } catch (error) {
    // Retry with same key - won't create duplicate
    return await fetch('/payments/create-intent', {
      method: 'POST',
      headers: {
        'X-Idempotency-Key': idempotencyKey,
        // ... other headers
      },
      body: JSON.stringify(paymentData)
    });
  }
}
```

### 2. PCI Compliance

- **Never store** raw credit card numbers
- Use payment provider's tokenization
- Implement secure checkout flows
- Use HTTPS for all payment endpoints

### 3. Fraud Prevention

- Monitor for unusual patterns
- Implement velocity checks
- Use 3D Secure for high-value transactions
- Set transaction limits

### 4. Error Handling

```javascript
// Handle payment errors gracefully
async function handlePayment(courseId, amount) {
  try {
    const result = await createPaymentIntent({
      courseId,
      amount,
      paymentMethod: 'CARD'
    });
    
    // Redirect to payment provider
    window.location.href = result.checkoutUrl;
    
  } catch (error) {
    if (error.code === 'CARD_DECLINED') {
      showErrorMessage('Your card was declined. Please try another payment method.');
    } else if (error.code === 'INSUFFICIENT_FUNDS') {
      showErrorMessage('Insufficient funds. Please use a different card.');
    } else {
      showErrorMessage('Payment failed. Please try again.');
    }
  }
}
```

---

## Testing

### Test Cards (Stripe)

| Card Number | Description |
|-------------|-------------|
| 4242 4242 4242 4242 | Success |
| 4000 0000 0000 9995 | Declined (insufficient funds) |
| 4000 0000 0000 9987 | Declined (expired card) |
| 4000 0000 0000 0069 | Requires 3D Secure |

### Test with cURL

```bash
# 1. Create payment intent
curl -X POST http://localhost:3000/payments/create-intent \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: test-key-123" \
  -d '{"courseId":"course-123","amount":4999,"currency":"USD","paymentMethod":"CARD"}'

# 2. Get payment history
curl http://localhost:3000/payments/user/payments \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. Get subscriptions
curl http://localhost:3000/payments/user/subscriptions \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Related Documentation

- [Courses API](../courses/courses-api.md)
- [Authentication API](../auth/auth-api.md)
- [OpenAPI Specification](../../openapi-spec.yaml.md)
- [API Index](../../README.md)
