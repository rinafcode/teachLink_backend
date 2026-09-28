# ManualRebalanceRequest

## Properties

| Name           | Type             | Description | Notes |
| -------------- | ---------------- | ----------- | ----- |
| **migrations** | **List[object]** |             |
| **dry_run**    | **bool**         |             |

## Example

```python
from openapi_client.models.manual_rebalance_request import ManualRebalanceRequest

# TODO update the JSON string below
json = "{}"
# create an instance of ManualRebalanceRequest from a JSON string
manual_rebalance_request_instance = ManualRebalanceRequest.from_json(json)
# print the JSON string representation of the object
print(ManualRebalanceRequest.to_json())

# convert the object into a dict
manual_rebalance_request_dict = manual_rebalance_request_instance.to_dict()
# create an instance of ManualRebalanceRequest from a dict
manual_rebalance_request_from_dict = ManualRebalanceRequest.from_dict(manual_rebalance_request_dict)
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
