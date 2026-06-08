import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserActivityController } from './controllers/user-activity.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';

/**
 * Users module to handle user-specific operations.
 * Currently focuses on providing user activity timeline and history.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    AuditLogModule,
  ],
  controllers: [UserActivityController],
})
export class UsersModule {}
