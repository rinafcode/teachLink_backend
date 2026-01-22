import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Challenge } from '../entities/challenge.entity';
import { UserChallenge } from '../entities/user-challenge.entity';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class ChallengesService {
  constructor(
    @InjectRepository(Challenge)
    private challengeRepository: Repository<Challenge>,
    @InjectRepository(UserChallenge)
    private userChallengeRepository: Repository<UserChallenge>,
  ) {}

  async updateProgress(userId: string, challengeId: string, increment: number) {
    let userChallenge = await this.userChallengeRepository.findOne({
      where: { user: { id: userId }, challenge: { id: challengeId } },
      relations: ['challenge'],
    });

    if (!userChallenge) {
      const challenge = await this.challengeRepository.findOne({ where: { id: challengeId } });
      if (!challenge) throw new Error('Challenge not found');

      userChallenge = this.userChallengeRepository.create({
        user: { id: userId } as User,
        challenge,
        progressValue: 0,
        isCompleted: false,
      });
    }

    if (userChallenge.isCompleted) return userChallenge;

    userChallenge.progressValue += increment;

    if (userChallenge.progressValue >= userChallenge.challenge.goalValue) {
      userChallenge.isCompleted = true;
      userChallenge.completedAt = new Date();
      // TODO: Reward user points via PointsService
    }

    return await this.userChallengeRepository.save(userChallenge);
  }

  async getUserChallenges(userId: string) {
    return await this.userChallengeRepository.find({
      where: { user: { id: userId } },
      relations: ['challenge'],
    });
  }
}
