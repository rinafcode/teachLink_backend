# ShardingApi

All URIs are relative to *http://localhost:3000*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**autoRebalance**](#autorebalance) | **POST** /sharding/rebalance/auto | Run automated rebalance analysis|
|[**getMigrationStatus**](#getmigrationstatus) | **GET** /sharding/migrations/{planId} | Get the status of a specific migration plan|
|[**listMigrations**](#listmigrations) | **GET** /sharding/migrations | List all migration plans and their statuses|
|[**manualRebalance**](#manualrebalance) | **POST** /sharding/rebalance | Trigger a manual shard rebalance|
|[**rollbackMigration**](#rollbackmigration) | **DELETE** /sharding/migrations/{planId} | Roll back a completed migration|
|[**routeShard**](#routeshard) | **POST** /sharding/route | Resolve which shard a key routes to|
|[**startMigration**](#startmigration) | **POST** /sharding/migrations | Start a cross-shard data migration|

# **autoRebalance**
> ApiSuccess autoRebalance(autoRebalanceRequest)


### Example

```typescript
import {
    ShardingApi,
    Configuration,
    AutoRebalanceRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new ShardingApi(configuration);

let autoRebalanceRequest: AutoRebalanceRequest; //

const { status, data } = await apiInstance.autoRebalance(
    autoRebalanceRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **autoRebalanceRequest** | **AutoRebalanceRequest**|  | |


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
|**202** | Auto-rebalance plan created |  -  |
|**400** | Invalid request |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getMigrationStatus**
> ApiSuccess getMigrationStatus()


### Example

```typescript
import {
    ShardingApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ShardingApi(configuration);

let planId: string; // (default to undefined)

const { status, data } = await apiInstance.getMigrationStatus(
    planId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **planId** | [**string**] |  | defaults to undefined|


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
|**200** | Migration status |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listMigrations**
> ApiSuccess listMigrations()


### Example

```typescript
import {
    ShardingApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ShardingApi(configuration);

const { status, data } = await apiInstance.listMigrations();
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
|**200** | Migration plans |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **manualRebalance**
> ApiSuccess manualRebalance(manualRebalanceRequest)


### Example

```typescript
import {
    ShardingApi,
    Configuration,
    ManualRebalanceRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new ShardingApi(configuration);

let manualRebalanceRequest: ManualRebalanceRequest; //

const { status, data } = await apiInstance.manualRebalance(
    manualRebalanceRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **manualRebalanceRequest** | **ManualRebalanceRequest**|  | |


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
|**202** | Rebalance plan created |  -  |
|**400** | Invalid request |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **rollbackMigration**
> ApiSuccess rollbackMigration()


### Example

```typescript
import {
    ShardingApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ShardingApi(configuration);

let planId: string; // (default to undefined)

const { status, data } = await apiInstance.rollbackMigration(
    planId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **planId** | [**string**] |  | defaults to undefined|


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
|**200** | Migration rolled back |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **routeShard**
> ApiSuccess routeShard(routeShardRequest)


### Example

```typescript
import {
    ShardingApi,
    Configuration,
    RouteShardRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new ShardingApi(configuration);

let routeShardRequest: RouteShardRequest; //

const { status, data } = await apiInstance.routeShard(
    routeShardRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **routeShardRequest** | **RouteShardRequest**|  | |


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
|**200** | Routing result |  -  |
|**400** | Invalid request |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **startMigration**
> ApiSuccess startMigration(startMigrationRequest)


### Example

```typescript
import {
    ShardingApi,
    Configuration,
    StartMigrationRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new ShardingApi(configuration);

let startMigrationRequest: StartMigrationRequest; //

const { status, data } = await apiInstance.startMigration(
    startMigrationRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **startMigrationRequest** | **StartMigrationRequest**|  | |


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
|**202** | Migration started |  -  |
|**400** | Invalid request |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

