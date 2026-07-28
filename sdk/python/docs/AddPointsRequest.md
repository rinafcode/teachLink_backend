# AddPointsRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**user_id** | **str** |  | 
**points** | **int** |  | 
**activity_type** | **str** |  | 

## Example

```python
from openapi_client.models.add_points_request import AddPointsRequest

# TODO update the JSON string below
json = "{}"
# create an instance of AddPointsRequest from a JSON string
add_points_request_instance = AddPointsRequest.from_json(json)
# print the JSON string representation of the object
print(AddPointsRequest.to_json())

# convert the object into a dict
add_points_request_dict = add_points_request_instance.to_dict()
# create an instance of AddPointsRequest from a dict
add_points_request_from_dict = AddPointsRequest.from_dict(add_points_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


