# ApiSuccess


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**success** | **bool** |  | [optional] 
**message** | **str** |  | [optional] 
**data** | **object** |  | [optional] 

## Example

```python
from openapi_client.models.api_success import ApiSuccess

# TODO update the JSON string below
json = "{}"
# create an instance of ApiSuccess from a JSON string
api_success_instance = ApiSuccess.from_json(json)
# print the JSON string representation of the object
print(ApiSuccess.to_json())

# convert the object into a dict
api_success_dict = api_success_instance.to_dict()
# create an instance of ApiSuccess from a dict
api_success_from_dict = ApiSuccess.from_dict(api_success_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


