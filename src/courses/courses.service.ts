import { Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { type Repository, Like, Between, type FindOptionsWhere } from "typeorm"
import { Course } from "./entities/course.entity"
import type { CreateCourseDto } from "./dto/create-course.dto"
import type { UpdateCourseDto } from "./dto/update-course.dto"
import type { QueryCourseDto } from "./dto/query-course.dto"
import { NotificationsService } from '../notifications/notifications.service'
import { NotificationType } from '../notifications/entities/notification.entity'

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course) private coursesRepository: Repository<Course>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(createCourseDto: CreateCourseDto): Promise<Course> {
    const course = this.coursesRepository.create(createCourseDto)
    return this.coursesRepository.save(course)
  }

  async findAll(queryParams: QueryCourseDto): Promise<{ data: Course[]; total: number; page: number; limit: number }> {
    const { search, level, isPublished, instructorId, minPrice, maxPrice, page, limit, sortBy, sortOrder } = queryParams

    const where: FindOptionsWhere<Course> = {}

    if (search) {
      where.title = Like(`%${search}%`)
    }

    if (level) {
      where.level = level
    }

    if (isPublished !== undefined) {
      where.isPublished = isPublished
    }

    if (instructorId) {
      where.instructorId = instructorId
    }

    if (minPrice !== undefined && maxPrice !== undefined) {
      where.price = Between(minPrice, maxPrice)
    } else if (minPrice !== undefined) {
      where.price = Between(minPrice, Number.MAX_SAFE_INTEGER)
    } else if (maxPrice !== undefined) {
      where.price = Between(0, maxPrice)
    }

    const [data, total] = await this.coursesRepository.findAndCount({
      where,
      order: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
      relations: ["modules"],
    })

    return {
      data,
      total,
      page,
      limit,
    }
  }

  async findOne(id: string): Promise<Course> {
    const course = await this.coursesRepository.findOne({
      where: { id },
      relations: ["modules", "modules.lessons"],
    })

    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`)
    }

    return course
  }

  async update(id: string, updateCourseDto: UpdateCourseDto): Promise<Course> {
    const course = await this.findOne(id)

    Object.assign(course, updateCourseDto)
    const updatedCourse = await this.coursesRepository.save(course)

    // Send notification to instructor
    if (updatedCourse.instructorId) {
      await this.notificationsService.createNotification(
        updatedCourse.instructorId,
        NotificationType.COURSE_UPDATE,
        `Your course "${updatedCourse.title}" has been updated.`
      )
    }

    return updatedCourse
  }

  async remove(id: string): Promise<void> {
    const result = await this.coursesRepository.delete(id)

    if (result.affected === 0) {
      throw new NotFoundException(`Course with ID ${id} not found`)
    }
  }

  async getAnalytics(id: string): Promise<any> {
    const course = await this.findOne(id)

    // Get enrollment data
    const enrollmentData = await this.coursesRepository
      .createQueryBuilder("course")
      .leftJoinAndSelect("course.enrollments", "enrollment")
      .where("course.id = :id", { id })
      .select("COUNT(enrollment.id)", "totalEnrollments")
      .addSelect("AVG(enrollment.progress)", "averageProgress")
      .getRawOne()

    // Get completion rate
    const completionData = await this.coursesRepository
      .createQueryBuilder("course")
      .leftJoinAndSelect("course.enrollments", "enrollment")
      .where("course.id = :id", { id })
      .andWhere("enrollment.completed = :completed", { completed: true })
      .select("COUNT(enrollment.id)", "completedCount")
      .getRawOne()

    const completionRate =
      enrollmentData.totalEnrollments > 0 ? (completionData.completedCount / enrollmentData.totalEnrollments) * 100 : 0

    return {
      courseId: id,
      title: course.title,
      totalEnrollments: enrollmentData.totalEnrollments,
      averageProgress: enrollmentData.averageProgress || 0,
      completionRate,
      averageRating: course.averageRating,
    }
  }
}
