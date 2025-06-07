import { Injectable, NotFoundException } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { Lesson } from "./entities/lesson.entity"
import type { CreateLessonDto } from "./dto/create-lesson.dto"
import type { UpdateLessonDto } from "./dto/update-lesson.dto"

@Injectable()
export class LessonsService {
  constructor(private lessonsRepository: Repository<Lesson>) {}

  async create(createLessonDto: CreateLessonDto): Promise<Lesson> {
    const lesson = this.lessonsRepository.create(createLessonDto)
    return this.lessonsRepository.save(lesson)
  }

  async findAll(moduleId: string): Promise<Lesson[]> {
    return this.lessonsRepository.find({
      where: { moduleId },
      order: { order: "ASC" },
    })
  }

  async findOne(id: string): Promise<Lesson> {
    const lesson = await this.lessonsRepository.findOne({
      where: { id },
    })

    if (!lesson) {
      throw new NotFoundException(`Lesson with ID ${id} not found`)
    }

    return lesson
  }

  async update(id: string, updateLessonDto: UpdateLessonDto): Promise<Lesson> {
    const lesson = await this.findOne(id)

    Object.assign(lesson, updateLessonDto)

    return this.lessonsRepository.save(lesson)
  }

  async remove(id: string): Promise<void> {
    const result = await this.lessonsRepository.delete(id)

    if (result.affected === 0) {
      throw new NotFoundException(`Lesson with ID ${id} not found`)
    }
  }

  async reorder(moduleId: string, lessonIds: string[]): Promise<Lesson[]> {
    const lessons = await this.findAll(moduleId)

    // Update order for each lesson
    const updates = lessonIds.map((id, index) => {
      const lesson = lessons.find((l) => l.id === id)
      if (!lesson) {
        throw new NotFoundException(`Lesson with ID ${id} not found`)
      }

      lesson.order = index + 1
      return this.lessonsRepository.save(lesson)
    })

    return Promise.all(updates)
  }
}
