import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository } from "typeorm"
import { Enrollment } from "./entities/enrollment.entity"
import { Course } from "../entities/course.entity"
import type { CreateEnrollmentDto } from "./dto/create-enrollment.dto"
import type { UpdateEnrollmentDto } from "./dto/update-enrollment.dto"

@Injectable()
export class EnrollmentsService {
  constructor(
    @InjectRepository(Enrollment)
    private enrollmentsRepository: Repository<Enrollment>,
    @InjectRepository(Course)
    private coursesRepository: Repository<Course>,
  ) {}

  async create(createEnrollmentDto: CreateEnrollmentDto): Promise<Enrollment> {
    // Check if user is already enrolled
    const existingEnrollment = await this.enrollmentsRepository.findOne({
      where: {
        courseId: createEnrollmentDto.courseId,
        userId: createEnrollmentDto.userId,
      },
    })

    if (existingEnrollment) {
      throw new BadRequestException("User is already enrolled in this course")
    }

    // Create enrollment
    const enrollment = this.enrollmentsRepository.create(createEnrollmentDto)
    const savedEnrollment = await this.enrollmentsRepository.save(enrollment)

    // Update course enrollment count
    await this.coursesRepository.increment({ id: createEnrollmentDto.courseId }, "enrollmentCount", 1)

    return savedEnrollment
  }

  async findAll(courseId?: string, userId?: string): Promise<Enrollment[]> {
    const where: any = {}

    if (courseId) {
      where.courseId = courseId
    }

    if (userId) {
      where.userId = userId
    }

    return this.enrollmentsRepository.find({
      where,
      order: { enrolledAt: "DESC" },
    })
  }

  async findOne(id: string): Promise<Enrollment> {
    const enrollment = await this.enrollmentsRepository.findOne({
      where: { id },
    })

    if (!enrollment) {
      throw new NotFoundException(`Enrollment with ID ${id} not found`)
    }

    return enrollment
  }

  async findByUserAndCourse(userId: string, courseId: string): Promise<Enrollment> {
    const enrollment = await this.enrollmentsRepository.findOne({
      where: { userId, courseId },
    })

    if (!enrollment) {
      throw new NotFoundException(`Enrollment for user ${userId} in course ${courseId} not found`)
    }

    return enrollment
  }

  async update(id: string, updateEnrollmentDto: UpdateEnrollmentDto): Promise<Enrollment> {
    const enrollment = await this.findOne(id)

    // Check if enrollment is being marked as completed
    const markingAsCompleted = !enrollment.completed && updateEnrollmentDto.completed === true

    Object.assign(enrollment, updateEnrollmentDto)

    // If marking as completed, set completedAt date
    if (markingAsCompleted) {
      enrollment.completedAt = new Date()
    }

    // If rating is provided, update course average rating
    if (updateEnrollmentDto.rating !== undefined) {
      await this.updateCourseRating(enrollment.courseId)
    }

    return this.enrollmentsRepository.save(enrollment)
  }

  async remove(id: string): Promise<void> {
    const enrollment = await this.findOne(id)
    const result = await this.enrollmentsRepository.delete(id)

    if (result.affected === 0) {
      throw new NotFoundException(`Enrollment with ID ${id} not found`)
    }

    // Decrement course enrollment count
    await this.coursesRepository.decrement({ id: enrollment.courseId }, "enrollmentCount", 1)
  }

  async updateProgress(id: string, lessonId: string, completed: boolean): Promise<Enrollment> {
    const enrollment = await this.findOne(id)

    // Update lesson progress
    enrollment.lessonProgress = {
      ...enrollment.lessonProgress,
      [lessonId]: completed,
    }

    // Calculate overall progress
    const course = await this.coursesRepository.findOne({
      where: { id: enrollment.courseId },
      relations: ["modules", "modules.lessons"],
    })

    let totalLessons = 0
    let completedLessons = 0

    course.modules.forEach((module) => {
      module.lessons.forEach((lesson) => {
        totalLessons++
        if (enrollment.lessonProgress[lesson.id]) {
          completedLessons++
        }
      })
    })

    enrollment.progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

    // Check if all lessons are completed
    if (enrollment.progress === 100) {
      enrollment.completed = true
      enrollment.completedAt = new Date()
    }

    return this.enrollmentsRepository.save(enrollment)
  }

  private async updateCourseRating(courseId: string): Promise<void> {
    const result = await this.enrollmentsRepository
      .createQueryBuilder("enrollment")
      .select("AVG(enrollment.rating)", "averageRating")
      .where("enrollment.courseId = :courseId", { courseId })
      .andWhere("enrollment.rating IS NOT NULL")
      .getRawOne()

    if (result && result.averageRating) {
      await this.coursesRepository.update(
        { id: courseId },
        { averageRating: +Number.parseFloat(result.averageRating).toFixed(1) },
      )
    }
  }
}
