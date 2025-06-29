import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { ModulesService } from "./modules.service"
import { ModulesController } from "./modules.controller"
import { Module as ModuleEntity } from "./entities/module.entity"

@Module({
  imports: [TypeOrmModule.forFeature([ModuleEntity])],
  controllers: [ModulesController],
  providers: [ModulesService],
  exports: [ModulesService],
})
export class ModulesModule {}
