import { Injectable } from '@nestjs/common';
import { ThrottlingService } from './services/throttling.service';
import { UserTier } from './services/quota.service';
import { CreateRateLimitingDto } from './dto/create-rate-limiting.dto';
import { UpdateRateLimitingDto } from './dto/update-rate-limiting.dto';

/**
 * Provides rate Limiting operations.
 */
@Injectable()
export class RateLimitingService {
  /**
   * Creates a new record.
   * @param _createRateLimitingDto The request payload.
   * @returns The operation result.
   */
  create(_createRateLimitingDto: CreateRateLimitingDto) {
    throw new Error('Method not implemented.');
  }
  /**
   * Retrieves all matching results.
   * @returns The operation result.
   */
  findAll() {
    throw new Error('Method not implemented.');
  }
  /**
   * Retrieves the requested record.
   * @param _arg0 The arg0.
   * @returns The operation result.
   */
  findOne(_arg0: number) {
    throw new Error('Method not implemented.');
  }
  /**
   * Updates the requested record.
   * @param _arg0 The arg0.
   * @param _updateRateLimitingDto The request payload.
   * @returns The operation result.
   */
  update(_arg0: number, _updateRateLimitingDto: UpdateRateLimitingDto) {
    throw new Error('Method not implemented.');
  }
  /**
   * Removes the requested record.
   * @param _arg0 The arg0.
   * @returns The operation result.
   */
  remove(_arg0: number) {
    throw new Error('Method not implemented.');
  }
  constructor(private readonly throttlingService: ThrottlingService) {}

  /**
   * Executes protect.
   * @param userId The user identifier.
   * @param tier The tier.
   * @param endpoint The endpoint.
   * @returns The operation result.
   */
  async protect(userId: string, tier: UserTier, endpoint: string) {
    await this.throttlingService.handleRequest(userId, tier, endpoint);
  }
}
