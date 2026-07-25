@Injectable()
export class CcpaService {
  getDisclosure(): Promise<DisclosureResponse>;

  getConsumerData(userId: string): Promise<ConsumerDataExport>;

  getPreferences(userId: string): Promise<ConsumerPrivacyPreference>;

  updatePreferences(
    userId: string,
    dto: UpdatePrivacyPreferencesDto,
  ): Promise<ConsumerPrivacyPreference>;

  deleteConsumerData(userId: string): Promise<void>;
}
