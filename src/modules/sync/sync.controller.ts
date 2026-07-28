@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('batch')
  async syncBatch(@Body() dto: SyncBatchDto, @Req() req) {
    return this.syncService.syncBatch(req.user.id, dto);
  }
}
