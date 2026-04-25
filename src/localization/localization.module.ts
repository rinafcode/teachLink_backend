import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Translation } from './entities/translation.entity';
import { LanguageDetectionService } from './language-detection.service';
import { LanguageMiddleware } from './language.middleware';
import { LocalizationController } from './localization.controller';
import { LocalizationService } from './localization.service';
@Module({
    imports: [TypeOrmModule.forFeature([Translation])],
    controllers: [LocalizationController],
    providers: [
        LocalizationService,
        LanguageDetectionService,
        LanguageMiddleware,
        JwtAuthGuard,
        RolesGuard,
    ],
    exports: [LocalizationService, LanguageDetectionService],
})
export class LocalizationModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(LanguageMiddleware).forRoutes(LocalizationController);
    }
}
