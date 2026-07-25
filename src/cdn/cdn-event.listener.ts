import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CdnService } from './cdn.service';

@Injectable()
export class CdnEventListener {
  private readonly logger = new Logger(CdnEventListener.name);

  constructor(private readonly cdnService: CdnService) {}

  @OnEvent('course.updated')
  async handleCourseUpdatedEvent(payload: { courseId: string; paths: string[] }) {
    this.logger.log(`Handling course.updated event for course ${payload.courseId}`);
    if (payload.paths && payload.paths.length > 0) {
      await this.cdnService.invalidate(payload.paths);
    }
  }

  @OnEvent('course.deleted')
  async handleCourseDeletedEvent(payload: { courseId: string; paths: string[] }) {
    this.logger.log(`Handling course.deleted event for course ${payload.courseId}`);
    if (payload.paths && payload.paths.length > 0) {
      await this.cdnService.invalidate(payload.paths);
    }
  }
}
