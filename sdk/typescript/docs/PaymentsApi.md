# PaymentsApi

All URIs are relative to *http://localhost:3000*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**createPaymentIntent**](#createpaymentintent) | **POST** /payments/create-intent | Create a payment intent|

# **createPaymentIntent**
> ApiSuccess createPaymentIntent(paymentIntentRequest)


### Example

```typescript
import {
    PaymentsApi,
    Configuration,
    PaymentIntentRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new PaymentsApi(configuration);

let paymentIntentRequest: PaymentIntentRequest; //
let xIdempotencyKey: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.createPaymentIntent(
    paymentIntentRequest,
    xIdempotencyKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **paymentIntentRequest** | **PaymentIntentRequest**|  | |
| **xIdempotencyKey** | [**string**] |  | (optional) defaults to undefined|


### Return type

**ApiSuccess**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**201** | Payment intent created |  -  |
|**409** | Duplicate idempotency key |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

