# RouteShardRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**key** | **str** |  | 
**strategy** | **str** |  | [optional] 
**for_read** | **bool** |  | [optional] 

## Example

```python
from openapi_client.models.route_shard_request import RouteShardRequest

# TODO update the JSON string below
json = "{}"
# create an instance of RouteShardRequest from a JSON string
route_shard_request_instance = RouteShardRequest.from_json(json)
# print the JSON string representation of the object
print(RouteShardRequest.to_json())

# convert the object into a dict
route_shard_request_dict = route_shard_request_instance.to_dict()
# create an instance of RouteShardRequest from a dict
route_shard_request_from_dict = RouteShardRequest.from_dict(route_shard_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


