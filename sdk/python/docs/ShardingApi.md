# openapi_client.ShardingApi

All URIs are relative to *http://localhost:3000*

Method | HTTP request | Description
------------- | ------------- | -------------
[**auto_rebalance**](ShardingApi.md#auto_rebalance) | **POST** /sharding/rebalance/auto | Run automated rebalance analysis
[**get_migration_status**](ShardingApi.md#get_migration_status) | **GET** /sharding/migrations/{planId} | Get the status of a specific migration plan
[**list_migrations**](ShardingApi.md#list_migrations) | **GET** /sharding/migrations | List all migration plans and their statuses
[**manual_rebalance**](ShardingApi.md#manual_rebalance) | **POST** /sharding/rebalance | Trigger a manual shard rebalance
[**rollback_migration**](ShardingApi.md#rollback_migration) | **DELETE** /sharding/migrations/{planId} | Roll back a completed migration
[**route_shard**](ShardingApi.md#route_shard) | **POST** /sharding/route | Resolve which shard a key routes to
[**start_migration**](ShardingApi.md#start_migration) | **POST** /sharding/migrations | Start a cross-shard data migration


# **auto_rebalance**
> ApiSuccess auto_rebalance(auto_rebalance_request)

Run automated rebalance analysis

### Example


```python
import openapi_client
from openapi_client.models.api_success import ApiSuccess
from openapi_client.models.auto_rebalance_request import AutoRebalanceRequest
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
    api_instance = openapi_client.ShardingApi(api_client)
    auto_rebalance_request = {"entityTypes":["users","courses"],"autoExecute":false} # AutoRebalanceRequest | 

    try:
        # Run automated rebalance analysis
        api_response = api_instance.auto_rebalance(auto_rebalance_request)
        print("The response of ShardingApi->auto_rebalance:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ShardingApi->auto_rebalance: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **auto_rebalance_request** | [**AutoRebalanceRequest**](AutoRebalanceRequest.md)|  | 

### Return type

[**ApiSuccess**](ApiSuccess.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**202** | Auto-rebalance plan created |  -  |
**400** | Invalid request |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_migration_status**
> ApiSuccess get_migration_status(plan_id)

Get the status of a specific migration plan

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
    api_instance = openapi_client.ShardingApi(api_client)
    plan_id = 'plan_001' # str | 

    try:
        # Get the status of a specific migration plan
        api_response = api_instance.get_migration_status(plan_id)
        print("The response of ShardingApi->get_migration_status:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ShardingApi->get_migration_status: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **plan_id** | **str**|  | 

### Return type

[**ApiSuccess**](ApiSuccess.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Migration status |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **list_migrations**
> ApiSuccess list_migrations()

List all migration plans and their statuses

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
    api_instance = openapi_client.ShardingApi(api_client)

    try:
        # List all migration plans and their statuses
        api_response = api_instance.list_migrations()
        print("The response of ShardingApi->list_migrations:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ShardingApi->list_migrations: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

[**ApiSuccess**](ApiSuccess.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Migration plans |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **manual_rebalance**
> ApiSuccess manual_rebalance(manual_rebalance_request)

Trigger a manual shard rebalance

### Example


```python
import openapi_client
from openapi_client.models.api_success import ApiSuccess
from openapi_client.models.manual_rebalance_request import ManualRebalanceRequest
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
    api_instance = openapi_client.ShardingApi(api_client)
    manual_rebalance_request = {"migrations":[{"sourceShardId":"shard-00","targetShardId":"shard-01","entityType":"users","estimatedRowCount":50000,"batchSize":1000,"dryRun":false}],"dryRun":false} # ManualRebalanceRequest | 

    try:
        # Trigger a manual shard rebalance
        api_response = api_instance.manual_rebalance(manual_rebalance_request)
        print("The response of ShardingApi->manual_rebalance:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ShardingApi->manual_rebalance: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **manual_rebalance_request** | [**ManualRebalanceRequest**](ManualRebalanceRequest.md)|  | 

### Return type

[**ApiSuccess**](ApiSuccess.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**202** | Rebalance plan created |  -  |
**400** | Invalid request |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **rollback_migration**
> ApiSuccess rollback_migration(plan_id)

Roll back a completed migration

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
    api_instance = openapi_client.ShardingApi(api_client)
    plan_id = 'plan_001' # str | 

    try:
        # Roll back a completed migration
        api_response = api_instance.rollback_migration(plan_id)
        print("The response of ShardingApi->rollback_migration:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ShardingApi->rollback_migration: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **plan_id** | **str**|  | 

### Return type

[**ApiSuccess**](ApiSuccess.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Migration rolled back |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **route_shard**
> ApiSuccess route_shard(route_shard_request)

Resolve which shard a key routes to

### Example


```python
import openapi_client
from openapi_client.models.api_success import ApiSuccess
from openapi_client.models.route_shard_request import RouteShardRequest
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
    api_instance = openapi_client.ShardingApi(api_client)
    route_shard_request = {"key":"user_123","strategy":"hash_based","forRead":false} # RouteShardRequest | 

    try:
        # Resolve which shard a key routes to
        api_response = api_instance.route_shard(route_shard_request)
        print("The response of ShardingApi->route_shard:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ShardingApi->route_shard: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **route_shard_request** | [**RouteShardRequest**](RouteShardRequest.md)|  | 

### Return type

[**ApiSuccess**](ApiSuccess.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Routing result |  -  |
**400** | Invalid request |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **start_migration**
> ApiSuccess start_migration(start_migration_request)

Start a cross-shard data migration

### Example


```python
import openapi_client
from openapi_client.models.api_success import ApiSuccess
from openapi_client.models.start_migration_request import StartMigrationRequest
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
    api_instance = openapi_client.ShardingApi(api_client)
    start_migration_request = {"sourceShardId":"shard-00","targetShardId":"shard-01","entityType":"users","estimatedRowCount":50000,"batchSize":1000,"dryRun":false} # StartMigrationRequest | 

    try:
        # Start a cross-shard data migration
        api_response = api_instance.start_migration(start_migration_request)
        print("The response of ShardingApi->start_migration:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling ShardingApi->start_migration: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **start_migration_request** | [**StartMigrationRequest**](StartMigrationRequest.md)|  | 

### Return type

[**ApiSuccess**](ApiSuccess.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**202** | Migration started |  -  |
**400** | Invalid request |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

