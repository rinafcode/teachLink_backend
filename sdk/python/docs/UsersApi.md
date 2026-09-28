# openapi_client.UsersApi

All URIs are relative to _http://localhost:3000_

| Method                                     | HTTP request    | Description   |
| ------------------------------------------ | --------------- | ------------- |
| [**create_user**](UsersApi.md#create_user) | **POST** /users | Create a user |
| [**list_users**](UsersApi.md#list_users)   | **GET** /users  | List users    |

# **create_user**

> ApiSuccess create_user(register_request)

Create a user

### Example

- Bearer (JWT) Authentication (bearerAuth):

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
    api_instance = openapi_client.UsersApi(api_client)
    register_request = {"email":"teacher@example.com","password":"Password123!","firstName":"Grace","lastName":"Hopper","role":"teacher"} # RegisterRequest |

    try:
        # Create a user
        api_response = api_instance.create_user(register_request)
        print("The response of UsersApi->create_user:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UsersApi->create_user: %s\n" % e)
```

### Parameters

| Name                 | Type                                      | Description | Notes |
| -------------------- | ----------------------------------------- | ----------- | ----- |
| **register_request** | [**RegisterRequest**](RegisterRequest.md) |             |

### Return type

[**ApiSuccess**](ApiSuccess.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description       | Response headers |
| ----------- | ----------------- | ---------------- |
| **201**     | User created      | -                |
| **400**     | Invalid user data | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **list_users**

> ApiSuccess list_users(page=page, limit=limit)

List users

### Example

- Bearer (JWT) Authentication (bearerAuth):

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
    api_instance = openapi_client.UsersApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    limit = 20 # int |  (optional) (default to 20)

    try:
        # List users
        api_response = api_instance.list_users(page=page, limit=limit)
        print("The response of UsersApi->list_users:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling UsersApi->list_users: %s\n" % e)
```

### Parameters

| Name      | Type    | Description | Notes                      |
| --------- | ------- | ----------- | -------------------------- |
| **page**  | **int** |             | [optional] [default to 1]  |
| **limit** | **int** |             | [optional] [default to 20] |

### Return type

[**ApiSuccess**](ApiSuccess.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description             | Response headers |
| ----------- | ----------------------- | ---------------- |
| **200**     | Users found             | -                |
| **401**     | Authentication required | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)
