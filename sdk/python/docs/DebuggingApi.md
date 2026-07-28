# openapi_client.DebuggingApi

All URIs are relative to *http://localhost:3000*

Method | HTTP request | Description
------------- | ------------- | -------------
[**clear_captured_requests**](DebuggingApi.md#clear_captured_requests) | **DELETE** /debug/requests | Clear the captured request buffer
[**list_captured_requests**](DebuggingApi.md#list_captured_requests) | **GET** /debug/requests | List recently captured requests


# **clear_captured_requests**
> ApiSuccess clear_captured_requests()

Clear the captured request buffer

### Example

* Bearer (JWT) Authentication (bearerAuth):

```python
import openapi_client
from openapi_client.models.api_success import ApiSuccess
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
    api_instance = openapi_client.DebuggingApi(api_client)

    try:
        # Clear the captured request buffer
        api_response = api_instance.clear_captured_requests()
        print("The response of DebuggingApi->clear_captured_requests:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DebuggingApi->clear_captured_requests: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

[**ApiSuccess**](ApiSuccess.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Capture buffer cleared |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **list_captured_requests**
> ApiSuccess list_captured_requests(limit=limit)

List recently captured requests

### Example

* Bearer (JWT) Authentication (bearerAuth):

```python
import openapi_client
from openapi_client.models.api_success import ApiSuccess
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
    api_instance = openapi_client.DebuggingApi(api_client)
    limit = 50 # int |  (optional) (default to 50)

    try:
        # List recently captured requests
        api_response = api_instance.list_captured_requests(limit=limit)
        print("The response of DebuggingApi->list_captured_requests:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DebuggingApi->list_captured_requests: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **limit** | **int**|  | [optional] [default to 50]

### Return type

[**ApiSuccess**](ApiSuccess.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Captured request summaries |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

