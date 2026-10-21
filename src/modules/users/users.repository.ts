import { AppDataSource } from '../../core/db/data-source';
import { User, UserRole } from './entities/user.entity';
import { UserRoleHistory } from './entities/user-role-history.entity';
import type { UserQueryParams } from './users.schemas';

export class UsersRepository {
  private get userRepo() {
    return AppDataSource.getRepository(User);
  }

  private get historyRepo() {
    return AppDataSource.getRepository(UserRoleHistory);
  }

  public async findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  public async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email: email.toLowerCase() } });
  }

  public async findAll(params: UserQueryParams): Promise<[User[], number]> {
    const query = this.userRepo.createQueryBuilder('user').where('user.deleted_at IS NULL');

    if (params.role) {
      query.andWhere('user.role = :role', { role: params.role });
    }

    if (params.status) {
      query.andWhere('user.is_active = :isActive', {
        isActive: params.status === 'active',
      });
    }

    if (params.search) {
      query.andWhere('(user.name ILIKE :search OR user.email ILIKE :search)', {
        search: `%${params.search}%`,
      });
    }

    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 20));

    query
      .orderBy('user.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    return query.getManyAndCount();
  }

  public async countActiveSuperAdmins(): Promise<number> {
    return this.userRepo.count({
      where: {
        role: UserRole.SUPER_ADMIN,
        isActive: true,
      },
    });
  }

  public async create(data: Partial<User>): Promise<User> {
    const user = this.userRepo.create(data);
    return this.userRepo.save(user);
  }

  public async save(user: User): Promise<User> {
    return this.userRepo.save(user);
  }

  public async saveRoleHistory(history: Partial<UserRoleHistory>): Promise<UserRoleHistory> {
    const record = this.historyRepo.create(history);
    return this.historyRepo.save(record);
  }

  public async closeActiveRoleHistory(userId: string, toAt: Date = new Date()): Promise<void> {
    await this.historyRepo
      .createQueryBuilder()
      .update(UserRoleHistory)
      .set({ toAt })
      .where('user_id = :userId AND to_at IS NULL AND deleted_at IS NULL', { userId })
      .execute();
  }
}

export const usersRepository = new UsersRepository();
