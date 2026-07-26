# DataPipelineApi

All URIs are relative to *http://localhost:3000*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**runEtl**](#runetl) | **POST** /data-pipeline/etl/run | Run an ETL job|

# **runEtl**
> ApiSuccess runEtl(runEtlRequest)


### Example

```typescript
import {
    DataPipelineApi,
    Configuration,
    RunEtlRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new DataPipelineApi(configuration);

let runEtlRequest: RunEtlRequest; //

const { status, data } = await apiInstance.runEtl(
    runEtlRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **runEtlRequest** | **RunEtlRequest**|  | |


### Return type

**ApiSuccess**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | ETL job completed |  -  |
|**400** | Invalid request |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

