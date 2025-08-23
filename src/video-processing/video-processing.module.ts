import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { ConfigModule } from "@nestjs/config"
import { ScheduleModule } from "@nestjs/schedule"
import { MulterModule } from "@nestjs/platform-express"

// Configuration
import videoProcessingConfig from "./config/video-processing.config"
import databaseConfig from "./config/database.config"

// Entities
import { Video } from "./entities/video.entity"
import { VideoVariant } from "./entities/video-variant.entity"
import { VideoProcessingJob } from "./entities/video-processing-job.entity"
import { ProcessingQueue } from "./entities/processing-queue.entity"

// Services
import { VideoProcessingService } from "./services/video-processing.service"
import { FFmpegService } from "./services/ffmpeg.service"
import { StorageService } from "./services/storage.service"
import { MetadataService } from "./services/metadata.service"
import { ThumbnailService } from "./services/thumbnail.service"
import { QueueService } from "./services/queue.service"
import { WorkerService } from "./services/worker.service"
import { SchedulerService } from "./services/scheduler.service"
import { MonitoringService } from "./services/monitoring.service"

// Controllers
import { VideoController } from "./controllers/video.controller"
import { MonitoringController } from "./controllers/monitoring.controller"

@Module({
  imports: [
    ConfigModule.forFeature(videoProcessingConfig),
    ConfigModule.forFeature(databaseConfig),
    TypeOrmModule.forFeature([Video, VideoVariant, VideoProcessingJob, ProcessingQueue]),
    ScheduleModule.forRoot(),
    MulterModule.register({
      dest: "./uploads",
    }),
  ],
  controllers: [VideoController, MonitoringController],
  providers: [
    VideoProcessingService,
    FFmpegService,
    StorageService,
    MetadataService,
    ThumbnailService,
    QueueService,
    WorkerService,
    SchedulerService,
    MonitoringService,
  ],
  exports: [
    VideoProcessingService,
    QueueService,
    MonitoringService,
    StorageService,
    FFmpegService,
    MetadataService,
    ThumbnailService,
  ],
})
export class VideoProcessingModule {}
