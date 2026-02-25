import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Badge } from '../entities/badge.entity';
import { UserBadge } from '../entities/user-badge.entity';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class BadgesService {
  constructor(
    @InjectRepository(Badge)
    private badgeRepository: Repository<Badge>,
    @InjectRepository(UserBadge)
    private userBadgeRepository: Repository<UserBadge>,
  ) {}

  async awardBadge(userId: string, badgeId: string) {
    const existingBadge = await this.userBadgeRepository.findOne({
      where: { user: { id: userId }, badge: { id: badgeId } },
    });

    if (existingBadge) {
      return existingBadge;
    }

    const userBadge = this.userBadgeRepository.create({
      user: { id: userId } as User,
      badge: { id: badgeId } as Badge,
    });

    return await this.userBadgeRepository.save(userBadge);
  }

  async getUserBadges(userId: string) {
    return await this.userBadgeRepository.find({
      where: { user: { id: userId } },
      relations: ['badge'],
    });
  }

  async getAllBadges() {
    return await this.badgeRepository.find();
  }
}
