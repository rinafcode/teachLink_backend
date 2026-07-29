# openapi_client.SearchApi

All URIs are relative to _http://localhost:3000_

| Method                                                | HTTP request                 | Description                         |
| ----------------------------------------------------- | ---------------------------- | ----------------------------------- |
| [**get_autocomplete**](SearchApi.md#get_autocomplete) | **GET** /search/autocomplete | Get search autocomplete suggestions |
| [**search_content**](SearchApi.md#search_content)     | **GET** /search              | Search courses and learning content |

# **get_autocomplete**

> ApiSuccess get_autocomplete(q)

Get search autocomplete suggestions

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
    api_instance = openapi_client.SearchApi(api_client)
    q = 'java' # str |

    try:
        # Get search autocomplete suggestions
        api_response = api_instance.get_autocomplete(q)
        print("The response of SearchApi->get_autocomplete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SearchApi->get_autocomplete: %s\n" % e)
```

### Parameters

| Name  | Type    | Description | Notes |
| ----- | ------- | ----------- | ----- |
| **q** | **str** |             |

### Return type

[**ApiSuccess**](ApiSuccess.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description              | Response headers |
| ----------- | ------------------------ | ---------------- |
| **200**     | Autocomplete suggestions | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **search_content**

> SearchResponse search_content(q, filters=filters, sort=sort, page=page, limit=limit)

Search courses and learning content

### Example

```python
import openapi_client
from openapi_client.models.search_response import SearchResponse
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
    api_instance = openapi_client.SearchApi(api_client)
    q = 'javascript basics' # str |
    filters = '{\"category\":\"programming\",\"level\":\"beginner\"}' # str |  (optional)
    sort = 'relevance' # str |  (optional)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # Search courses and learning content
        api_response = api_instance.search_content(q, filters=filters, sort=sort, page=page, limit=limit)
        print("The response of SearchApi->search_content:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SearchApi->search_content: %s\n" % e)
```

### Parameters

| Name        | Type    | Description | Notes                      |
| ----------- | ------- | ----------- | -------------------------- |
| **q**       | **str** |             |
| **filters** | **str** |             | [optional]                 |
| **sort**    | **str** |             | [optional]                 |
| **page**    | **int** |             | [optional] [default to 1]  |
| **limit**   | **int** |             | [optional] [default to 20] |

### Return type

[**SearchResponse**](SearchResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description          | Response headers |
| ----------- | -------------------- | ---------------- |
| **200**     | Search results       | -                |
| **400**     | Invalid filters JSON | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)
