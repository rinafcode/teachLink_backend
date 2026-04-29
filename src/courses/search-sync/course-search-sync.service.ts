import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { IndexingService } from '../../search/indexing/indexing.service';
import { CACHE_EVENTS } from '../../caching/caching.constants';

@Injectable()
export class CourseSearchSyncService {
  private readonly logger = new Logger(CourseSearchSyncService.name);

  constructor(private readonly indexingService: IndexingService) {}

  @OnEvent(CACHE_EVENTS.COURSE_CREATED)
  async onCourseCreated(payload: { course: Record<string, any> }): Promise<void> {
    try {
      await this.indexingService.syncCourse(payload.course);
    } catch (err) {
      this.logger.warn(`Failed to index new course ${payload.course?.id}: ${err.message}`);
    }
  }

  @OnEvent(CACHE_EVENTS.COURSE_UPDATED)
  async onCourseUpdated(payload: { courseId: string; fields?: Record<string, any> }): Promise<void> {
    try {
      if (payload.fields) {
        await this.indexingService.updateCourse(payload.courseId, payload.fields);
      }
    } catch (err) {
      this.logger.warn(`Failed to update search index for course ${payload.courseId}: ${err.message}`);
    }
  }

  @OnEvent(CACHE_EVENTS.COURSE_DELETED)
  async onCourseDeleted(payload: { courseId: string }): Promise<void> {
    try {
      await this.indexingService.removeCourse(payload.courseId);
    } catch (err) {
      this.logger.warn(`Failed to remove course ${payload.courseId} from search index: ${err.message}`);
    }
  }
}
