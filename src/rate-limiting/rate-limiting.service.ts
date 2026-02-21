import { Injectable } from '@nestjs/common';
import { ThrottlingService } from './services/throttling.service';
import { UserTier } from './services/quota.service';
import { CreateRateLimitingDto } from './dto/create-rate-limiting.dto';
import { UpdateRateLimitingDto } from './dto/update-rate-limiting.dto';

@Injectable()
export class RateLimitingService {
  create(createRateLimitingDto: CreateRateLimitingDto) {
    throw new Error('Method not implemented.');
  }
  findAll() {
    throw new Error('Method not implemented.');
  }
  findOne(arg0: number) {
    throw new Error('Method not implemented.');
  }
  update(arg0: number, updateRateLimitingDto: UpdateRateLimitingDto) {
    throw new Error('Method not implemented.');
  }
  remove(arg0: number) {
    throw new Error('Method not implemented.');
  }
  constructor(private readonly throttlingService: ThrottlingService) {}

  async protect(
    userId: string,
    tier: UserTier,
    endpoint: string,
  ) {
    await this.throttlingService.handleRequest(
      userId,
      tier,
      endpoint,
    );
  }
}