import { getMetadataArgsStorage } from 'typeorm';
import { AutomationTrigger } from './automation-trigger.entity';

describe('AutomationTrigger entity - index metadata', () => {
  it('declares indexes for the trigger lookup and workflow foreign key paths', () => {
    const indices = getMetadataArgsStorage().filterIndices(AutomationTrigger);
    const indexedProperties = indices.flatMap((index) =>
      Array.isArray(index.columns)
        ? (index.columns as any[]).map((column) => column.propertyName ?? column)
        : [],
    );

    expect(indexedProperties).toEqual(expect.arrayContaining(['workflowId', 'type']));
  });
});
