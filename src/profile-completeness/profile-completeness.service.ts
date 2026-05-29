import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';

export interface ProfileScoreResult {
  score: number;
  maxScore: number;
  percentage: number;
  completedFields: string[];
  missingFields: string[];
  level: 'starter' | 'intermediate' | 'complete';
  nextIncentive: string | null;
}

const SCORED_FIELDS: Array<{ field: keyof User; label: string; points: number }> = [
  { field: 'firstName', label: 'First name', points: 10 },
  { field: 'lastName', label: 'Last name', points: 10 },
  { field: 'username', label: 'Username', points: 10 },
  { field: 'profilePicture', label: 'Profile picture', points: 20 },
  { field: 'isEmailVerified', label: 'Email verified', points: 20 },
  { field: 'role', label: 'Role set', points: 10 },
  { field: 'lastLoginAt', label: 'Logged in at least once', points: 10 },
  { field: 'tenantId', label: 'Organisation linked', points: 10 },
];

const MAX_SCORE = SCORED_FIELDS.reduce((sum, f) => sum + f.points, 0);

@Injectable()
export class ProfileCompletenessService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getScore(userId: string): Promise<ProfileScoreResult> {
    const user = await this.userRepository.findOneOrFail({ where: { id: userId } });
    return this.calculateScore(user);
  }

  calculateScore(user: User): ProfileScoreResult {
    let score = 0;
    const completedFields: string[] = [];
    const missingFields: string[] = [];

    for (const { field, label, points } of SCORED_FIELDS) {
      const value = user[field];
      const filled = value !== null && value !== undefined && value !== '' && value !== false;
      if (filled) {
        score += points;
        completedFields.push(label);
      } else {
        missingFields.push(label);
      }
    }

    const percentage = Math.round((score / MAX_SCORE) * 100);
    const level =
      percentage >= 80 ? 'complete' : percentage >= 40 ? 'intermediate' : 'starter';

    const nextIncentive =
      level === 'starter'
        ? 'Reach 40% to unlock Intermediate badge'
        : level === 'intermediate'
        ? 'Reach 80% to unlock Complete Profile badge'
        : null;

    return { score, maxScore: MAX_SCORE, percentage, completedFields, missingFields, level, nextIncentive };
  }
}