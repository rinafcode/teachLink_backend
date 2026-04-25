import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { QUEUE_NAMES } from '../common/constants/queue.constants';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { Enrollment } from '../courses/entities/enrollment.entity';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExportService, UserDataExportProcessor, UserExportHistory, } from '../common/export/export.service';
@Module({
    imports: [
        TypeOrmModule.forFeature([User, Enrollment, UserExportHistory]),
        BullModule.registerQueue({ name: QUEUE_NAMES.USER_DATA_EXPORT }),
    ],
    controllers: [UsersController],
    providers: [UsersService, ExportService, UserDataExportProcessor, RolesGuard, JwtAuthGuard],
    exports: [UsersService],
})
export class UsersModule {
}
