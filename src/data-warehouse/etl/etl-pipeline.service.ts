import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class ETLPipelineService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  // Extract, Transform, Load pipeline logic
  async runETL(): Promise<void> {
    // Extract: Get all users
    const users = await this.userRepository.find();

    // Transform: Placeholder for transformation logic
    const transformedUsers = users.map((user) => ({
      ...user,
      // Example transformation: add a new field or modify existing
      extractedAt: new Date(),
    }));

    // Load: Placeholder for loading logic (e.g., save to warehouse table)
    // await this.warehouseRepository.save(transformedUsers);
    console.log('ETL complete. Transformed users:', transformedUsers.length);
  }
}
