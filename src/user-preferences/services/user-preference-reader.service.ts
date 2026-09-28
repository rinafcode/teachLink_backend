import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPreference } from '../entities/user-preference.entity';

@Injectable()
export class UserPreferenceReaderService {
  constructor(
    @InjectRepository(UserPreference)
    private readonly repo: Repository<UserPreference>,
  ) {}

  async getByUserId(userId: string): Promise<UserPreference> {
    return this.repo.findOne({
      where: { userId },
    });
  }
}
