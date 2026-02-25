import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Enrollment } from '../entities/enrollment.entity';
import { Course } from '../entities/course.entity';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class EnrollmentsService {
  constructor(
    @InjectRepository(Enrollment)
    private enrollmentsRepository: Repository<Enrollment>,
    @InjectRepository(Course)
    private coursesRepository: Repository<Course>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async enroll(userId: string, courseId: string): Promise<Enrollment> {
    const existing = await this.enrollmentsRepository.findOne({
      where: { user: { id: userId }, course: { id: courseId } },
    });
    if (existing) {
      throw new ConflictException('User is already enrolled in this course');
    }

    const user = await this.usersRepository.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('User not found');
    
    const course = await this.coursesRepository.findOneBy({ id: courseId });
    if (!course) throw new NotFoundException('Course not found');

    const enrollment = this.enrollmentsRepository.create({
      user,
      course,
      progress: 0,
      status: 'active',
    });
    return this.enrollmentsRepository.save(enrollment);
  }

  async findUserEnrollments(userId: string): Promise<Enrollment[]> {
    return this.enrollmentsRepository.find({
      where: { user: { id: userId } },
      relations: ['course'],
    });
  }

  async updateProgress(enrollmentId: string, progress: number): Promise<Enrollment> {
      const enrollment = await this.enrollmentsRepository.findOneBy({ id: enrollmentId });
      if (!enrollment) throw new NotFoundException('Enrollment not found');
      
      enrollment.progress = progress;
      if (progress >= 100) {
          enrollment.status = 'completed';
      }
      return this.enrollmentsRepository.save(enrollment);
  }
}
