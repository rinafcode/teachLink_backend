import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPreference } from './entities/user-preference.entity';
import { UpdateUserPreferenceDto } from './dto/update-user-preference.dto';

@Injectable()
export class UserPreferencesService {
  private readonly logger = new Logger(UserPreferencesService.name);

  constructor(
    @InjectRepository(UserPreference)
    private readonly preferenceRepository: Repository<UserPreference>,
  ) {}

  async getPreferences(userId: string): Promise<UserPreference> {
    let prefs = await this.preferenceRepository.findOne({ where: { userId } });
    if (!prefs) {
      prefs = await this.preferenceRepository.save(this.preferenceRepository.create({ userId }));
      this.logger.debug(`Created default preferences for user ${userId}`);
    }
    return prefs;
  }

  async updatePreferences(userId: string, dto: UpdateUserPreferenceDto): Promise<UserPreference> {
    const prefs = await this.getPreferences(userId);
    Object.assign(prefs, dto);
    return this.preferenceRepository.save(prefs);
  }

  async resetPreferences(userId: string): Promise<UserPreference> {
    const prefs = await this.getPreferences(userId);
    await this.preferenceRepository.remove(prefs);
    return this.preferenceRepository.save(this.preferenceRepository.create({ userId }));
  }
}
