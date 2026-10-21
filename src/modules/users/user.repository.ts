import { DataSource, EntityManager, Repository } from 'typeorm';

import { AppDataSource } from '../../core/db';
import { User, UserRole } from './entities/user.entity';

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
  role?: UserRole;
  mustChangePassword?: boolean;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export class UserRepository {
  private readonly repo: Repository<User>;

  constructor(dataSource: DataSource = AppDataSource) {
    this.repo = dataSource.getRepository(User);
  }

  private getRepo(manager?: EntityManager): Repository<User> {
    return manager ? manager.getRepository(User) : this.repo;
  }

  public async findByEmail(email: string, manager?: EntityManager): Promise<User | null> {
    return this.getRepo(manager).findOne({
      where: { email: email.trim().toLowerCase() },
    });
  }

  public async findById(id: string, manager?: EntityManager): Promise<User | null> {
    return this.getRepo(manager).findOne({
      where: { id },
    });
  }

  public async create(data: CreateUserData, manager?: EntityManager): Promise<User> {
    const repo = this.getRepo(manager);
    const user = repo.create({
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      passwordHash: data.passwordHash,
      role: data.role ?? UserRole.MENTEE,
      ...(data.mustChangePassword !== undefined
        ? { mustChangePassword: data.mustChangePassword }
        : {}),
      tokenVersion: 0,
      isActive: true,
      createdBy: data.createdBy ?? null,
      updatedBy: data.updatedBy ?? null,
    });
    return repo.save(user);
  }

  public async updateLastLogin(id: string, manager?: EntityManager): Promise<void> {
    await this.getRepo(manager).update(id, {
      lastLoginAt: new Date(),
    });
  }

  public async updatePassword(
    id: string,
    passwordHash: string,
    manager?: EntityManager,
  ): Promise<void> {
    await this.getRepo(manager).update(id, {
      passwordHash,
      mustChangePassword: false,
    });
  }

  public async incrementTokenVersion(id: string, manager?: EntityManager): Promise<void> {
    await this.getRepo(manager).increment({ id }, 'tokenVersion', 1);
  }
}

export const userRepository = new UserRepository();
