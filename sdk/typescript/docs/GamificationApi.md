# GamificationApi

All URIs are relative to _http://localhost:3000_

| Method                                  | HTTP request                                   | Description                      |
| --------------------------------------- | ---------------------------------------------- | -------------------------------- |
| [**addPoints**](#addpoints)             | **POST** /gamification/points/add              | Add points to a user             |
| [**awardActivity**](#awardactivity)     | **POST** /gamification/points/award-activity   | Award points for a user activity |
| [**getLeaderboard**](#getleaderboard)   | **GET** /gamification/leaderboard              | Get leaderboard                  |
| [**getUserProgress**](#getuserprogress) | **GET** /gamification/points/progress/{userId} | Get user progress and points     |
| [**upsertReward**](#upsertreward)       | **POST** /gamification/tiers/rewards/{tier}    | Create or update a tier reward   |

# **addPoints**

> ApiSuccess addPoints(addPointsRequest)

### Example

```typescript
import { GamificationApi, Configuration, AddPointsRequest } from './api';

const configuration = new Configuration();
const apiInstance = new GamificationApi(configuration);

let addPointsRequest: AddPointsRequest; //

const { status, data } = await apiInstance.addPoints(addPointsRequest);
```

### Parameters

| Name                 | Type                 | Description | Notes |
| -------------------- | -------------------- | ----------- | ----- |
| **addPointsRequest** | **AddPointsRequest** |             |       |

### Return type

**ApiSuccess**

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

# **awardActivity**

> ApiSuccess awardActivity(awardActivityRequest)

### Example

```typescript
import { GamificationApi, Configuration, AwardActivityRequest } from './api';

const configuration = new Configuration();
const apiInstance = new GamificationApi(configuration);

let awardActivityRequest: AwardActivityRequest; //

const { status, data } = await apiInstance.awardActivity(awardActivityRequest);
```

### Parameters

| Name                     | Type                     | Description | Notes |
| ------------------------ | ------------------------ | ----------- | ----- |
| **awardActivityRequest** | **AwardActivityRequest** |             |       |

### Return type

**ApiSuccess**

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

# **getLeaderboard**

> ApiSuccess getLeaderboard()

### Example

```typescript
import { GamificationApi, Configuration } from './api';

const configuration = new Configuration();
const apiInstance = new GamificationApi(configuration);

let page: number; // (optional) (default to 1)
let pageSize: number; // (optional) (default to 20)

const { status, data } = await apiInstance.getLeaderboard(page, pageSize);
```

### Parameters

| Name         | Type         | Description | Notes                     |
| ------------ | ------------ | ----------- | ------------------------- |
| **page**     | [**number**] |             | (optional) defaults to 1  |
| **pageSize** | [**number**] |             | (optional) defaults to 20 |

### Return type

**ApiSuccess**

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

# **getUserProgress**

> ApiSuccess getUserProgress()

### Example

```typescript
import { GamificationApi, Configuration } from './api';

const configuration = new Configuration();
const apiInstance = new GamificationApi(configuration);

let userId: string; // (default to undefined)

const { status, data } = await apiInstance.getUserProgress(userId);
```

### Parameters

| Name       | Type         | Description | Notes                 |
| ---------- | ------------ | ----------- | --------------------- |
| **userId** | [**string**] |             | defaults to undefined |

### Return type

**ApiSuccess**

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

# **upsertReward**

> ApiSuccess upsertReward(upsertRewardRequest)

### Example

```typescript
import { GamificationApi, Configuration, UpsertRewardRequest } from './api';

const configuration = new Configuration();
const apiInstance = new GamificationApi(configuration);

let tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND'; // (default to undefined)
let upsertRewardRequest: UpsertRewardRequest; //

const { status, data } = await apiInstance.upsertReward(tier, upsertRewardRequest);
```

### Parameters

| Name                    | Type                    | Description      | Notes          |
| ----------------------- | ----------------------- | ---------------- | -------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --------------------- |
| **upsertRewardRequest** | **UpsertRewardRequest** |                  |                |
| **tier**                | [\*\*&#39;BRONZE&#39;   | &#39;SILVER&#39; | &#39;GOLD&#39; | &#39;PLATINUM&#39; | &#39;DIAMOND&#39;**]**Array<&#39;BRONZE&#39; &#124; &#39;SILVER&#39; &#124; &#39;GOLD&#39; &#124; &#39;PLATINUM&#39; &#124; &#39;DIAMOND&#39;>\*\* |     | defaults to undefined |

### Return type

**ApiSuccess**

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
