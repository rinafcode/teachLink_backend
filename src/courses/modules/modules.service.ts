import { Injectable, NotFoundException } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { Module } from "./entities/module.entity"
import type { CreateModuleDto } from "./dto/create-module.dto"
import type { UpdateModuleDto } from "./dto/update-module.dto"

@Injectable()
export class ModulesService {
  constructor(private modulesRepository: Repository<Module>) {}

  async create(createModuleDto: CreateModuleDto): Promise<Module> {
    const module = this.modulesRepository.create(createModuleDto)
    return this.modulesRepository.save(module)
  }

  async findAll(courseId: string): Promise<Module[]> {
    return this.modulesRepository.find({
      where: { courseId },
      order: { order: "ASC" },
      relations: ["lessons"],
    })
  }

  async findOne(id: string): Promise<Module> {
    const module = await this.modulesRepository.findOne({
      where: { id },
      relations: ["lessons"],
    })

    if (!module) {
      throw new NotFoundException(`Module with ID ${id} not found`)
    }

    return module
  }

  async update(id: string, updateModuleDto: UpdateModuleDto): Promise<Module> {
    const module = await this.findOne(id)

    Object.assign(module, updateModuleDto)

    return this.modulesRepository.save(module)
  }

  async remove(id: string): Promise<void> {
    const result = await this.modulesRepository.delete(id)

    if (result.affected === 0) {
      throw new NotFoundException(`Module with ID ${id} not found`)
    }
  }

  async reorder(courseId: string, moduleIds: string[]): Promise<Module[]> {
    const modules = await this.findAll(courseId)

    // Update order for each module
    const updates = moduleIds.map((id, index) => {
      const module = modules.find((m) => m.id === id)
      if (!module) {
        throw new NotFoundException(`Module with ID ${id} not found`)
      }

      module.order = index + 1
      return this.modulesRepository.save(module)
    })

    return Promise.all(updates)
  }
}
