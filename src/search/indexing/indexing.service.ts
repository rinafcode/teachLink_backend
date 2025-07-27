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

  async bulkIndexCourses(courses: any[]) {
    if (!Array.isArray(courses) || courses.length === 0) return;
    const body = courses.flatMap(course => [
      { index: { _index: 'courses', _id: course.id } },
      course,
    ]);
    await this.esService.bulk({ refresh: true, body });
  }


} 