# PaymentIntentRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**course_id** | **UUID** |  | 
**amount** | **float** |  | 
**currency** | **str** |  | 

## Example

```python
from openapi_client.models.payment_intent_request import PaymentIntentRequest

# TODO update the JSON string below
json = "{}"
# create an instance of PaymentIntentRequest from a JSON string
payment_intent_request_instance = PaymentIntentRequest.from_json(json)
# print the JSON string representation of the object
print(PaymentIntentRequest.to_json())

# convert the object into a dict
payment_intent_request_dict = payment_intent_request_instance.to_dict()
# create an instance of PaymentIntentRequest from a dict
payment_intent_request_from_dict = PaymentIntentRequest.from_dict(payment_intent_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


