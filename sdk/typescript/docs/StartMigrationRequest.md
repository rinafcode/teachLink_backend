# StartMigrationRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**sourceShardId** | **string** |  | [default to undefined]
**targetShardId** | **string** |  | [default to undefined]
**entityType** | **string** |  | [default to undefined]
**estimatedRowCount** | **number** |  | [default to undefined]
**batchSize** | **number** |  | [default to undefined]
**dryRun** | **boolean** |  | [default to undefined]

## Example

```typescript
import { StartMigrationRequest } from './api';

const instance: StartMigrationRequest = {
    sourceShardId,
    targetShardId,
    entityType,
    estimatedRowCount,
    batchSize,
    dryRun,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
