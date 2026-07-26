# AwardActivityRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**user_id** | **str** |  | 
**activity_type** | **str** |  | 

## Example

```python
from openapi_client.models.award_activity_request import AwardActivityRequest

# TODO update the JSON string below
json = "{}"
# create an instance of AwardActivityRequest from a JSON string
award_activity_request_instance = AwardActivityRequest.from_json(json)
# print the JSON string representation of the object
print(AwardActivityRequest.to_json())

# convert the object into a dict
award_activity_request_dict = award_activity_request_instance.to_dict()
# create an instance of AwardActivityRequest from a dict
award_activity_request_from_dict = AwardActivityRequest.from_dict(award_activity_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


