# openapi_client.AuthApi

All URIs are relative to _http://localhost:3000_

| Method                                        | HTTP request            | Description                    |
| --------------------------------------------- | ----------------------- | ------------------------------ |
| [**login_user**](AuthApi.md#login_user)       | **POST** /auth/login    | Log in with email and password |
| [**register_user**](AuthApi.md#register_user) | **POST** /auth/register | Register a new user            |

# **login_user**

> ApiSuccess login_user(login_request)

Log in with email and password

### Example

```python
import openapi_client
from openapi_client.models.api_success import ApiSuccess
from openapi_client.models.login_request import LoginRequest
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
    api_instance = openapi_client.AuthApi(api_client)
    login_request = {"email":"learner@example.com","password":"Password123!"} # LoginRequest |

    try:
        # Log in with email and password
        api_response = api_instance.login_user(login_request)
        print("The response of AuthApi->login_user:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthApi->login_user: %s\n" % e)
```

### Parameters

| Name              | Type                                | Description | Notes |
| ----------------- | ----------------------------------- | ----------- | ----- |
| **login_request** | [**LoginRequest**](LoginRequest.md) |             |

### Return type

[**ApiSuccess**](ApiSuccess.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description         | Response headers |
| ----------- | ------------------- | ---------------- |
| **200**     | Login successful    | -                |
| **401**     | Invalid credentials | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **register_user**

> ApiSuccess register_user(register_request)

Register a new user

### Example

```python
import openapi_client
from openapi_client.models.api_success import ApiSuccess
from openapi_client.models.register_request import RegisterRequest
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
    api_instance = openapi_client.AuthApi(api_client)
    register_request = {"email":"learner@example.com","password":"Password123!","firstName":"Ada","lastName":"Lovelace","role":"student"} # RegisterRequest |

    try:
        # Register a new user
        api_response = api_instance.register_user(register_request)
        print("The response of AuthApi->register_user:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling AuthApi->register_user: %s\n" % e)
```

### Parameters

| Name                 | Type                                      | Description | Notes |
| -------------------- | ----------------------------------------- | ----------- | ----- |
| **register_request** | [**RegisterRequest**](RegisterRequest.md) |             |

### Return type

[**ApiSuccess**](ApiSuccess.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description               | Response headers |
| ----------- | ------------------------- | ---------------- |
| **201**     | Registration successful   | -                |
| **400**     | Invalid registration data | -                |
| **409**     | Email already exists      | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)
