export class SyncBatchDto {
  @ValidateNested({
    each: true,
  })
  actions: SyncActionDto[];
}