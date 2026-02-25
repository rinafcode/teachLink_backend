import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import {  RateLimitingService } from './rate-limiting.service';
import { RateLimitGuard } from './services/limit-guard/guard';
import { CreateRateLimitingDto } from './dto/create-rate-limiting.dto';
import { UpdateRateLimitingDto } from './dto/update-rate-limiting.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('rate-limiting')
export class RateLimitingController {
  constructor(private readonly rateLimitingService: RateLimitingService) {}


  @Post()
  create(@Body() createRateLimitingDto: CreateRateLimitingDto) {
    return this.rateLimitingService.create(createRateLimitingDto);
  }

  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @Get()
  findAll() {
    return this.rateLimitingService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.rateLimitingService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRateLimitingDto: UpdateRateLimitingDto) {
    return this.rateLimitingService.update(+id, updateRateLimitingDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.rateLimitingService.remove(+id);
  }
}
