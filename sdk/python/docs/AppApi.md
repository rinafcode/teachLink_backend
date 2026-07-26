# openapi_client.AppApi

All URIs are relative to *http://localhost:3000*

Method | HTTP request | Description
------------- | ------------- | -------------
[**get_app_status**](AppApi.md#get_app_status) | **GET** / | Get app status


# **get_app_status**
> ApiSuccess get_app_status()

Get app status

### Example


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


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.AppApi(api_client)

    try:
        # Get app status
        api_response = api_instance.get_app_status()
        print("The response of AppApi->get_app_status:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AppApi->get_app_status: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

[**ApiSuccess**](ApiSuccess.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | App is running |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

