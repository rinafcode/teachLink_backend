# openapi_client.DataPipelineApi

All URIs are relative to _http://localhost:3000_

| Method                                    | HTTP request                    | Description    |
| ----------------------------------------- | ------------------------------- | -------------- |
| [**run_etl**](DataPipelineApi.md#run_etl) | **POST** /data-pipeline/etl/run | Run an ETL job |

# **run_etl**

> ApiSuccess run_etl(run_etl_request)

Run an ETL job

### Example

```python
import openapi_client
from openapi_client.models.api_success import ApiSuccess
from openapi_client.models.run_etl_request import RunEtlRequest
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
    api_instance = openapi_client.DataPipelineApi(api_client)
    run_etl_request = {"source":"sales_csv","data":[{"id":1,"name":"example"}]} # RunEtlRequest |

    try:
        # Run an ETL job
        api_response = api_instance.run_etl(run_etl_request)
        print("The response of DataPipelineApi->run_etl:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DataPipelineApi->run_etl: %s\n" % e)
```

### Parameters

| Name                | Type                                  | Description | Notes |
| ------------------- | ------------------------------------- | ----------- | ----- |
| **run_etl_request** | [**RunEtlRequest**](RunEtlRequest.md) |             |

### Return type

[**ApiSuccess**](ApiSuccess.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description       | Response headers |
| ----------- | ----------------- | ---------------- |
| **200**     | ETL job completed | -                |
| **400**     | Invalid request   | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)
