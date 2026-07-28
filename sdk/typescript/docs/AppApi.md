# AppApi

All URIs are relative to *http://localhost:3000*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**getAppStatus**](#getappstatus) | **GET** / | Get app status|

# **getAppStatus**
> ApiSuccess getAppStatus()


### Example

```typescript
import {
    AppApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AppApi(configuration);

const { status, data } = await apiInstance.getAppStatus();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**ApiSuccess**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | App is running |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

