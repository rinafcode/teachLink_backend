# UpsertRewardRequest

## Properties

| Name             | Type       | Description | Notes      |
| ---------------- | ---------- | ----------- | ---------- |
| **title**        | **str**    |             |
| **description**  | **str**    |             |
| **badge_id**     | **str**    |             | [optional] |
| **bonus_points** | **int**    |             | [optional] |
| **metadata**     | **object** |             | [optional] |

## Example

```python
from openapi_client.models.upsert_reward_request import UpsertRewardRequest

# TODO update the JSON string below
json = "{}"
# create an instance of UpsertRewardRequest from a JSON string
upsert_reward_request_instance = UpsertRewardRequest.from_json(json)
# print the JSON string representation of the object
print(UpsertRewardRequest.to_json())

# convert the object into a dict
upsert_reward_request_dict = upsert_reward_request_instance.to_dict()
# create an instance of UpsertRewardRequest from a dict
upsert_reward_request_from_dict = UpsertRewardRequest.from_dict(upsert_reward_request_dict)
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
