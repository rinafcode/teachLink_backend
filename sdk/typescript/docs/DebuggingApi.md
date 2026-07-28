# DebuggingApi

All URIs are relative to _http://localhost:3000_

| Method                                              | HTTP request               | Description                       |
| --------------------------------------------------- | -------------------------- | --------------------------------- |
| [**clearCapturedRequests**](#clearcapturedrequests) | **DELETE** /debug/requests | Clear the captured request buffer |
| [**listCapturedRequests**](#listcapturedrequests)   | **GET** /debug/requests    | List recently captured requests   |

# **clearCapturedRequests**

> ApiSuccess clearCapturedRequests()

### Example

```typescript
import { DebuggingApi, Configuration } from './api';

const configuration = new Configuration();
const apiInstance = new DebuggingApi(configuration);

const { status, data } = await apiInstance.clearCapturedRequests();
```

### Parameters

This endpoint does not have any parameters.

### Return type

**ApiSuccess**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description            | Response headers |
| ----------- | ---------------------- | ---------------- |
| **200**     | Capture buffer cleared | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listCapturedRequests**

> ApiSuccess listCapturedRequests()

### Example

```typescript
import { DebuggingApi, Configuration } from './api';

const configuration = new Configuration();
const apiInstance = new DebuggingApi(configuration);

let limit: number; // (optional) (default to 50)

const { status, data } = await apiInstance.listCapturedRequests(limit);
```

### Parameters

| Name      | Type         | Description | Notes                     |
| --------- | ------------ | ----------- | ------------------------- |
| **limit** | [**number**] |             | (optional) defaults to 50 |

### Return type

**ApiSuccess**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description                | Response headers |
| ----------- | -------------------------- | ---------------- |
| **200**     | Captured request summaries | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)
