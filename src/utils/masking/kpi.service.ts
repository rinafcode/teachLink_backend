import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Course } from '../../courses/entities/course.entity';
import { Enrollment } from '../../courses/entities/enrollment.entity';
import { User } from '../../users/entities/user.entity';
import { MetricsService } from '../../observability/metrics.service'; // Assuming observability exists

@Injectable()
export class KpiService {
  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly metricsService: MetricsService,
  ) {}

  async calculateEnrollmentConversionRate() {
    const startTime = Date.now();
    try {
      const courses = await this.courseRepository.find();
      
      const enrollmentCounts = await this.enrollmentRepository
        .createQueryBuilder('enrollment')
        .select('enrollment.courseId', 'courseId')
        .addSelect('COUNT(*)', 'count')
        .groupBy('enrollment.courseId')
        .getRawMany();

      const countMap = new Map<number, number>();
      enrollmentCounts.forEach((row) => {
        countMap.set(row.courseId, parseInt(row.count, 10));
      });

      return courses.map(course => ({
        courseId: course.id,
        enrollmentCount: countMap.get(course.id) || 0,
        // Conversion rate logic here (mocked for this issue)
        conversionRate: 0 
      }));
    } finally {
      const duration = Date.now() - startTime;
      this.metricsService.recordMetric('kpi_job_duration_ms', duration);
    }
  }

  async calculateUserRetention(cohortMonth: string) {
    const startTime = Date.now();
    try {
      // Replaced userRepository.find() with a COUNT aggregate per cohort window
      const result = await this.userRepository
        .createQueryBuilder('user')
        .select('COUNT(*)', 'count')
        .where('user.cohortMonth = :cohortMonth', { cohortMonth })
        .getRawOne();
      
      return {
        cohortMonth,
        retentionCount: parseInt(result.count, 10) || 0
      };
    } finally {
      const duration = Date.now() - startTime;
      this.metricsService.recordMetric('kpi_job_duration_ms', duration);
    }
  }
}
