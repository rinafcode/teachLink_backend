import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { CoursesService } from "./courses.service"
import { CoursesController } from "./courses.controller"
import { Course } from "./entities/course.entity"
import { ModulesModule } from "./modules/modules.module"
import { LessonsModule } from "./lessons/lessons.module"
import { EnrollmentsModule } from "./enrollments/enrollments.module"

@Module({
  imports: [TypeOrmModule.forFeature([Course]), ModulesModule, LessonsModule, EnrollmentsModule],
  controllers: [CoursesController],
  providers: [CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}
