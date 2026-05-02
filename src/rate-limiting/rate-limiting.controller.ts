import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { RateLimitingService } from './rate-limiting.service';
import { RateLimitGuard } from './services/limit-guard/guard';
import { CreateRateLimitingDto } from './dto/create-rate-limiting.dto';
import { UpdateRateLimitingDto } from './dto/update-rate-limiting.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Exposes rate Limiting endpoints.
 */
@Controller('rate-limiting')
export class RateLimitingController {
  constructor(private readonly rateLimitingService: RateLimitingService) {}

  /**
   * Creates a new record.
   * @param createRateLimitingDto The request payload.
   * @returns The operation result.
   */
  @Post()
  create(@Body() createRateLimitingDto: CreateRateLimitingDto) {
    return this.rateLimitingService.create(createRateLimitingDto);
  }

  /**
   * Returns all.
   * @returns The operation result.
   */
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @Get()
  findAll() {
    return this.rateLimitingService.findAll();
  }

  /**
   * Returns one.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.rateLimitingService.findOne(+id);
  }

  /**
   * Updates the requested record.
   * @param id The identifier.
   * @param updateRateLimitingDto The request payload.
   * @returns The operation result.
   */
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRateLimitingDto: UpdateRateLimitingDto) {
    return this.rateLimitingService.update(+id, updateRateLimitingDto);
  }

  /**
   * Removes the requested record.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.rateLimitingService.remove(+id);
  }
}
