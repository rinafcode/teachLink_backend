# AutoRebalanceRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**entity_types** | **List[str]** |  | 
**auto_execute** | **bool** |  | 

## Example

```python
from openapi_client.models.auto_rebalance_request import AutoRebalanceRequest

# TODO update the JSON string below
json = "{}"
# create an instance of AutoRebalanceRequest from a JSON string
auto_rebalance_request_instance = AutoRebalanceRequest.from_json(json)
# print the JSON string representation of the object
print(AutoRebalanceRequest.to_json())

# convert the object into a dict
auto_rebalance_request_dict = auto_rebalance_request_instance.to_dict()
# create an instance of AutoRebalanceRequest from a dict
auto_rebalance_request_from_dict = AutoRebalanceRequest.from_dict(auto_rebalance_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


