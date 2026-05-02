# AuthLoginPostRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**email** | **str** |  | 
**password** | **str** |  | 

## Example

```python
from openapi_client.models.auth_login_post_request import AuthLoginPostRequest

# TODO update the JSON string below
json = "{}"
# create an instance of AuthLoginPostRequest from a JSON string
auth_login_post_request_instance = AuthLoginPostRequest.from_json(json)
# print the JSON string representation of the object
print(AuthLoginPostRequest.to_json())

# convert the object into a dict
auth_login_post_request_dict = auth_login_post_request_instance.to_dict()
# create an instance of AuthLoginPostRequest from a dict
auth_login_post_request_from_dict = AuthLoginPostRequest.from_dict(auth_login_post_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


