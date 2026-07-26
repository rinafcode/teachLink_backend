# SearchApi

All URIs are relative to *http://localhost:3000*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**getAutocomplete**](#getautocomplete) | **GET** /search/autocomplete | Get search autocomplete suggestions|
|[**searchContent**](#searchcontent) | **GET** /search | Search courses and learning content|

# **getAutocomplete**
> ApiSuccess getAutocomplete()


### Example

```typescript
import {
    SearchApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SearchApi(configuration);

let q: string; // (default to undefined)

const { status, data } = await apiInstance.getAutocomplete(
    q
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **q** | [**string**] |  | defaults to undefined|


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
|**200** | Autocomplete suggestions |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **searchContent**
> SearchResponse searchContent()


### Example

```typescript
import {
    SearchApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SearchApi(configuration);

let q: string; // (default to undefined)
let filters: string; // (optional) (default to undefined)
let sort: string; // (optional) (default to undefined)
let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.searchContent(
    q,
    filters,
    sort,
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **q** | [**string**] |  | defaults to undefined|
| **filters** | [**string**] |  | (optional) defaults to undefined|
| **sort** | [**string**] |  | (optional) defaults to undefined|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|


### Return type

**SearchResponse**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Search results |  -  |
|**400** | Invalid filters JSON |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

