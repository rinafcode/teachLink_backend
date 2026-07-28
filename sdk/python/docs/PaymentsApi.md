# openapi_client.PaymentsApi

All URIs are relative to _http://localhost:3000_

| Method                                                            | HTTP request                     | Description             |
| ----------------------------------------------------------------- | -------------------------------- | ----------------------- |
| [**create_payment_intent**](PaymentsApi.md#create_payment_intent) | **POST** /payments/create-intent | Create a payment intent |

# **create_payment_intent**

> ApiSuccess create_payment_intent(payment_intent_request, x_idempotency_key=x_idempotency_key)

Create a payment intent

### Example

- Bearer (JWT) Authentication (bearerAuth):

```python
import openapi_client
from openapi_client.models.api_success import ApiSuccess
from openapi_client.models.payment_intent_request import PaymentIntentRequest
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost:3000
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost:3000"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization (JWT): bearerAuth
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.PaymentsApi(api_client)
    payment_intent_request = {"courseId":"8e4fd4f8-d8f3-46b5-8786-6f7167a654f4","amount":3999,"currency":"USD"} # PaymentIntentRequest |
    x_idempotency_key = 'payment-8e4fd4f8-d8f3-46b5' # str |  (optional)

    try:
        # Create a payment intent
        api_response = api_instance.create_payment_intent(payment_intent_request, x_idempotency_key=x_idempotency_key)
        print("The response of PaymentsApi->create_payment_intent:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling PaymentsApi->create_payment_intent: %s\n" % e)
```

### Parameters

| Name                       | Type                                                | Description | Notes      |
| -------------------------- | --------------------------------------------------- | ----------- | ---------- |
| **payment_intent_request** | [**PaymentIntentRequest**](PaymentIntentRequest.md) |             |
| **x_idempotency_key**      | **str**                                             |             | [optional] |

### Return type

[**ApiSuccess**](ApiSuccess.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description               | Response headers |
| ----------- | ------------------------- | ---------------- |
| **201**     | Payment intent created    | -                |
| **409**     | Duplicate idempotency key | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)
