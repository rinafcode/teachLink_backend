# RunEtlRequest

## Properties

| Name       | Type             | Description | Notes |
| ---------- | ---------------- | ----------- | ----- |
| **source** | **str**          |             |
| **data**   | **List[object]** |             |

## Example

```python
from openapi_client.models.run_etl_request import RunEtlRequest

# TODO update the JSON string below
json = "{}"
# create an instance of RunEtlRequest from a JSON string
run_etl_request_instance = RunEtlRequest.from_json(json)
# print the JSON string representation of the object
print(RunEtlRequest.to_json())

# convert the object into a dict
run_etl_request_dict = run_etl_request_instance.to_dict()
# create an instance of RunEtlRequest from a dict
run_etl_request_from_dict = RunEtlRequest.from_dict(run_etl_request_dict)
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
