import { DataSource, Repository } from 'typeorm';

import { AppDataSource } from '../../core/db';
import { User, UserRole } from './entities/user.entity';

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
  role?: UserRole;
  mustChangePassword?: boolean;
}

export class UserRepository {
  private readonly repo: Repository<User>;

  constructor(dataSource: DataSource = AppDataSource) {
    this.repo = dataSource.getRepository(User);
  }

  public async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({
      where: { email: email.trim().toLowerCase() },
    });
  }

  public async findById(id: string): Promise<User | null> {
    return this.repo.findOne({
      where: { id },
    });
  }

  public async create(data: CreateUserData): Promise<User> {
    const user = this.repo.create({
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      passwordHash: data.passwordHash,
      role: data.role ?? UserRole.MENTEE,
      mustChangePassword: data.mustChangePassword ?? false,
      tokenVersion: 0,
      isActive: true,
    });
    return this.repo.save(user);
  }

  public async updateLastLogin(id: string): Promise<void> {
    await this.repo.update(id, {
      lastLoginAt: new Date(),
    });
  }

  public async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.repo.update(id, {
      passwordHash,
      mustChangePassword: false,
    });
  }

  public async incrementTokenVersion(id: string): Promise<void> {
    await this.repo.increment({ id }, 'tokenVersion', 1);
  }
}

export const userRepository = new UserRepository();
