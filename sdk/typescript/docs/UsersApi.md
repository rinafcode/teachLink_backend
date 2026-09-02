# UsersApi

All URIs are relative to _http://localhost:3000_

| Method                        | HTTP request    | Description   |
| ----------------------------- | --------------- | ------------- |
| [**createUser**](#createuser) | **POST** /users | Create a user |
| [**listUsers**](#listusers)   | **GET** /users  | List users    |

# **createUser**

> ApiSuccess createUser(registerRequest)

### Example

```typescript
import { UsersApi, Configuration, RegisterRequest } from './api';

const configuration = new Configuration();
const apiInstance = new UsersApi(configuration);

let registerRequest: RegisterRequest; //

const { status, data } = await apiInstance.createUser(registerRequest);
```

### Parameters

| Name                | Type                | Description | Notes |
| ------------------- | ------------------- | ----------- | ----- |
| **registerRequest** | **RegisterRequest** |             |       |

### Return type

**ApiSuccess**

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

# **listUsers**

> ApiSuccess listUsers()

### Example

```typescript
import { UsersApi, Configuration } from './api';

const configuration = new Configuration();
const apiInstance = new UsersApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listUsers(page, limit);
```

### Parameters

| Name      | Type         | Description | Notes                     |
| --------- | ------------ | ----------- | ------------------------- |
| **page**  | [**number**] |             | (optional) defaults to 1  |
| **limit** | [**number**] |             | (optional) defaults to 20 |

### Return type

**ApiSuccess**

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
