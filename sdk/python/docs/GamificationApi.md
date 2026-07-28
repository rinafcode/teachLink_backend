# openapi_client.GamificationApi

All URIs are relative to _http://localhost:3000_

| Method                                                        | HTTP request                                   | Description                      |
| ------------------------------------------------------------- | ---------------------------------------------- | -------------------------------- |
| [**add_points**](GamificationApi.md#add_points)               | **POST** /gamification/points/add              | Add points to a user             |
| [**award_activity**](GamificationApi.md#award_activity)       | **POST** /gamification/points/award-activity   | Award points for a user activity |
| [**get_leaderboard**](GamificationApi.md#get_leaderboard)     | **GET** /gamification/leaderboard              | Get leaderboard                  |
| [**get_user_progress**](GamificationApi.md#get_user_progress) | **GET** /gamification/points/progress/{userId} | Get user progress and points     |
| [**upsert_reward**](GamificationApi.md#upsert_reward)         | **POST** /gamification/tiers/rewards/{tier}    | Create or update a tier reward   |

# **add_points**

> ApiSuccess add_points(add_points_request)

Add points to a user

### Example

```python
import openapi_client
from openapi_client.models.add_points_request import AddPointsRequest
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
    api_instance = openapi_client.GamificationApi(api_client)
    add_points_request = {"userId":"user_123","points":100,"activityType":"COURSE_COMPLETED"} # AddPointsRequest |

    try:
        # Add points to a user
        api_response = api_instance.add_points(add_points_request)
        print("The response of GamificationApi->add_points:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling GamificationApi->add_points: %s\n" % e)
```

### Parameters

| Name                   | Type                                        | Description | Notes |
| ---------------------- | ------------------------------------------- | ----------- | ----- |
| **add_points_request** | [**AddPointsRequest**](AddPointsRequest.md) |             |

### Return type

[**ApiSuccess**](ApiSuccess.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description     | Response headers |
| ----------- | --------------- | ---------------- |
| **200**     | Points added    | -                |
| **400**     | Invalid request | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **award_activity**

> ApiSuccess award_activity(award_activity_request)

Award points for a user activity

### Example

```python
import openapi_client
from openapi_client.models.api_success import ApiSuccess
from openapi_client.models.award_activity_request import AwardActivityRequest
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
    api_instance = openapi_client.GamificationApi(api_client)
    award_activity_request = {"userId":"user_123","activityType":"COURSE_COMPLETED"} # AwardActivityRequest |

    try:
        # Award points for a user activity
        api_response = api_instance.award_activity(award_activity_request)
        print("The response of GamificationApi->award_activity:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling GamificationApi->award_activity: %s\n" % e)
```

### Parameters

| Name                       | Type                                                | Description | Notes |
| -------------------------- | --------------------------------------------------- | ----------- | ----- |
| **award_activity_request** | [**AwardActivityRequest**](AwardActivityRequest.md) |             |

### Return type

[**ApiSuccess**](ApiSuccess.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description      | Response headers |
| ----------- | ---------------- | ---------------- |
| **200**     | Activity awarded | -                |
| **400**     | Invalid request  | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_leaderboard**

> ApiSuccess get_leaderboard(page=page, page_size=page_size)

Get leaderboard

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
    api_instance = openapi_client.GamificationApi(api_client)
    page = 1 # int |  (optional) (default to 1)
    page_size = 20 # int |  (optional) (default to 20)

    try:
        # Get leaderboard
        api_response = api_instance.get_leaderboard(page=page, page_size=page_size)
        print("The response of GamificationApi->get_leaderboard:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling GamificationApi->get_leaderboard: %s\n" % e)
```

### Parameters

| Name          | Type    | Description | Notes                      |
| ------------- | ------- | ----------- | -------------------------- |
| **page**      | **int** |             | [optional] [default to 1]  |
| **page_size** | **int** |             | [optional] [default to 20] |

### Return type

[**ApiSuccess**](ApiSuccess.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     | Leaderboard | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_user_progress**

> ApiSuccess get_user_progress(user_id)

Get user progress and points

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
    api_instance = openapi_client.GamificationApi(api_client)
    user_id = 'user_123' # str |

    try:
        # Get user progress and points
        api_response = api_instance.get_user_progress(user_id)
        print("The response of GamificationApi->get_user_progress:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling GamificationApi->get_user_progress: %s\n" % e)
```

### Parameters

| Name        | Type    | Description | Notes |
| ----------- | ------- | ----------- | ----- |
| **user_id** | **str** |             |

### Return type

[**ApiSuccess**](ApiSuccess.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description   | Response headers |
| ----------- | ------------- | ---------------- |
| **200**     | User progress | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **upsert_reward**

> ApiSuccess upsert_reward(tier, upsert_reward_request)

Create or update a tier reward

### Example

```python
import openapi_client
from openapi_client.models.api_success import ApiSuccess
from openapi_client.models.upsert_reward_request import UpsertRewardRequest
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
    api_instance = openapi_client.GamificationApi(api_client)
    tier = 'GOLD' # str |
    upsert_reward_request = {"title":"Gold Badge","description":"Awarded for reaching Gold tier","badgeId":"badge_gold","bonusPoints":500} # UpsertRewardRequest |

    try:
        # Create or update a tier reward
        api_response = api_instance.upsert_reward(tier, upsert_reward_request)
        print("The response of GamificationApi->upsert_reward:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling GamificationApi->upsert_reward: %s\n" % e)
```

### Parameters

| Name                      | Type                                              | Description | Notes |
| ------------------------- | ------------------------------------------------- | ----------- | ----- |
| **tier**                  | **str**                                           |             |
| **upsert_reward_request** | [**UpsertRewardRequest**](UpsertRewardRequest.md) |             |

### Return type

[**ApiSuccess**](ApiSuccess.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description     | Response headers |
| ----------- | --------------- | ---------------- |
| **200**     | Reward saved    | -                |
| **400**     | Invalid request | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)
