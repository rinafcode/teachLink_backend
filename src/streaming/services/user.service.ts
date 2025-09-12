import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import { type User, UserRole } from '../entities/user.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UserService {
  constructor(private userRepository: Repository<User>) {}

  async create(userData: Partial<User>): Promise<User> {
    const existingUser = await this.userRepository.findOne({
      where: { email: userData.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(userData.passwordHash, 10);
    const user = this.userRepository.create({
      ...userData,
      passwordHash: hashedPassword,
    });

    return this.userRepository.save(user);
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['instructedRooms', 'participations'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByEmail(email: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async validatePassword(
    email: string,
    password: string,
  ): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (user && (await bcrypt.compare(password, user.passwordHash))) {
      return user;
    }

    return null;
  }

  async updateProfile(id: string, updateData: Partial<User>): Promise<User> {
    const user = await this.findById(id);

    if (updateData.passwordHash) {
      updateData.passwordHash = await bcrypt.hash(updateData.passwordHash, 10);
    }

    Object.assign(user, updateData);
    return this.userRepository.save(user);
  }

  async findInstructors(): Promise<User[]> {
    return this.userRepository.find({
      where: { role: UserRole.INSTRUCTOR, isActive: true },
      select: ['id', 'email', 'firstName', 'lastName', 'avatar'],
    });
  }

  async deactivateUser(id: string): Promise<void> {
    await this.userRepository.update(id, { isActive: false });
  }
}
