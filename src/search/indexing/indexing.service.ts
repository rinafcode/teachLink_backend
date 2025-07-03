import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';

@Injectable()
export class IndexingService {
  constructor(private readonly esService: ElasticsearchService) {}

  async indexCourse(course: any) {
    await this.esService.index({
      index: 'courses',
      id: course.id,
      body: course,
    });
  }

  async removeCourse(courseId: string) {
    await this.esService.delete({
      index: 'courses',
      id: courseId,
    });
  }

  // Add bulk indexing, update, etc. as needed
} 