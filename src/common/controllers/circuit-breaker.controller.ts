import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EnhancedCircuitBreakerService } from '../services/circuit-breaker.service';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { UserRole } from '../../users/entities/user.entity';

@ApiTags('circuit-breakers')
@Controller('circuit-breakers')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CircuitBreakerController {
  constructor(private readonly circuitBreakerService: EnhancedCircuitBreakerService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all circuit breaker statistics' })
  getAllStats() {
    return this.circuitBreakerService.getAllStats();
  }

  @Get('health')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get circuit breaker health status' })
  getHealthStatus() {
    return this.circuitBreakerService.getHealthStatus();
  }

  @Get(':key')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get specific circuit breaker statistics' })
  getStats(@Param('key') key: string) {
    const stats = this.circuitBreakerService.getStats(key);
    if (!stats) {
      return { error: 'Circuit breaker not found' };
    }
    return stats;
  }

  @Post(':key/reset')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Reset a circuit breaker' })
  resetCircuitBreaker(@Param('key') key: string) {
    this.circuitBreakerService.close(key);
    return { message: `Circuit breaker ${key} has been reset` };
  }

  @Post(':key/disable')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Disable a circuit breaker' })
  disableCircuitBreaker(@Param('key') key: string) {
    this.circuitBreakerService.disable(key);
    return { message: `Circuit breaker ${key} has been disabled` };
  }

  @Post(':key/enable')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Enable a circuit breaker' })
  enableCircuitBreaker(@Param('key') key: string) {
    this.circuitBreakerService.enable(key);
    return { message: `Circuit breaker ${key} has been enabled` };
  }
}
