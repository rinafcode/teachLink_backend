# openapi_client.CoursesApi

All URIs are relative to _http://localhost:3000_

| Method                                           | HTTP request      | Description     |
| ------------------------------------------------ | ----------------- | --------------- |
| [**create_course**](CoursesApi.md#create_course) | **POST** /courses | Create a course |
| [**list_courses**](CoursesApi.md#list_courses)   | **GET** /courses  | List courses    |

# **create_course**

> ApiSuccess create_course(course_request)

Create a course

### Example

- Bearer (JWT) Authentication (bearerAuth):

```python
import openapi_client
from openapi_client.models.api_success import ApiSuccess
from openapi_client.models.course_request import CourseRequest
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
    api_instance = openapi_client.CoursesApi(api_client)
    course_request = {"title":"JavaScript Foundations","description":"Learn modern JavaScript from first principles.","category":"programming","level":"beginner","price":3999} # CourseRequest |

    try:
        # Create a course
        api_response = api_instance.create_course(course_request)
        print("The response of CoursesApi->create_course:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CoursesApi->create_course: %s\n" % e)
```

### Parameters

| Name               | Type                                  | Description | Notes |
| ------------------ | ------------------------------------- | ----------- | ----- |
| **course_request** | [**CourseRequest**](CourseRequest.md) |             |

### Return type

[**ApiSuccess**](ApiSuccess.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description         | Response headers |
| ----------- | ------------------- | ---------------- |
| **201**     | Course created      | -                |
| **400**     | Invalid course data | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **list_courses**

> ApiSuccess list_courses(page=page, limit=limit)

List courses

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
    api_instance = openapi_client.CoursesApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # List courses
        api_response = api_instance.list_courses(page=page, limit=limit)
        print("The response of CoursesApi->list_courses:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling CoursesApi->list_courses: %s\n" % e)
```

### Parameters

| Name      | Type    | Description | Notes                      |
| --------- | ------- | ----------- | -------------------------- |
| **page**  | **int** |             | [optional] [default to 1]  |
| **limit** | **int** |             | [optional] [default to 20] |

### Return type

[**ApiSuccess**](ApiSuccess.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description   | Response headers |
| ----------- | ------------- | ---------------- |
| **200**     | Courses found | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)
