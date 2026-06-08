@Injectable()
export class SyncService {
  constructor(
    @InjectRepository(SyncAction)
    private readonly repo: Repository<SyncAction>,
  ) {}

  async syncBatch(userId: string, dto: SyncBatchDto) {
    const actions = dto.actions.map((action) =>
      this.repo.create({
        userId,
        actionType: action.actionType,
        payload: action.payload,
      }),
    );

    await this.repo.save(actions);

    return {
      synced: actions.length,
    };
  }
}
