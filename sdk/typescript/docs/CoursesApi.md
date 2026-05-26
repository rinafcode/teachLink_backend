# CoursesApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**coursesGet**](#coursesget) | **GET** /courses | Get all courses|
|[**coursesIdDelete**](#coursesiddelete) | **DELETE** /courses/{id} | Delete course|
|[**coursesIdGet**](#coursesidget) | **GET** /courses/{id} | Get course by ID|
|[**coursesIdPatch**](#coursesidpatch) | **PATCH** /courses/{id} | Update course|
|[**coursesPost**](#coursespost) | **POST** /courses | Create a new course|

# **coursesGet**
> coursesGet()


### Example

```typescript
import {
    CoursesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesApi(configuration);

const { status, data } = await apiInstance.coursesGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Courses found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **coursesIdDelete**
> coursesIdDelete()


### Example

```typescript
import {
    CoursesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesApi(configuration);

let id: string; // (default to undefined)

const { status, data } = await apiInstance.coursesIdDelete(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Course deleted |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **coursesIdGet**
> coursesIdGet()


### Example

```typescript
import {
    CoursesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesApi(configuration);

let id: string; // (default to undefined)

const { status, data } = await apiInstance.coursesIdGet(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Course found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **coursesIdPatch**
> coursesIdPatch()


### Example

```typescript
import {
    CoursesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesApi(configuration);

let id: string; // (default to undefined)

const { status, data } = await apiInstance.coursesIdPatch(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Course updated |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **coursesPost**
> coursesPost(coursesPostRequest)


### Example

```typescript
import {
    CoursesApi,
    Configuration,
    CoursesPostRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new CoursesApi(configuration);

let coursesPostRequest: CoursesPostRequest; //

const { status, data } = await apiInstance.coursesPost(
    coursesPostRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **coursesPostRequest** | **CoursesPostRequest**|  | |


### Return type

void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**201** | Course created |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

