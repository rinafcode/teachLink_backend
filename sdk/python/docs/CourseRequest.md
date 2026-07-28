# CourseRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**title** | **str** |  | 
**description** | **str** |  | 
**category** | **str** |  | [optional] 
**level** | **str** |  | [optional] 
**price** | **float** |  | [optional] 

## Example

```python
from openapi_client.models.course_request import CourseRequest

# TODO update the JSON string below
json = "{}"
# create an instance of CourseRequest from a JSON string
course_request_instance = CourseRequest.from_json(json)
# print the JSON string representation of the object
print(CourseRequest.to_json())

# convert the object into a dict
course_request_dict = course_request_instance.to_dict()
# create an instance of CourseRequest from a dict
course_request_from_dict = CourseRequest.from_dict(course_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


