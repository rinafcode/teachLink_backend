# CoursesPostRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**title** | **str** |  | 
**description** | **str** |  | [optional] 

## Example

```python
from openapi_client.models.courses_post_request import CoursesPostRequest

# TODO update the JSON string below
json = "{}"
# create an instance of CoursesPostRequest from a JSON string
courses_post_request_instance = CoursesPostRequest.from_json(json)
# print the JSON string representation of the object
print(CoursesPostRequest.to_json())

# convert the object into a dict
courses_post_request_dict = courses_post_request_instance.to_dict()
# create an instance of CoursesPostRequest from a dict
courses_post_request_from_dict = CoursesPostRequest.from_dict(courses_post_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


