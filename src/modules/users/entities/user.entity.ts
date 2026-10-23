import { Column, Entity, Index } from 'typeorm';

import { AuditableEntity } from '../../../core/db';

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  MENTOR = 'MENTOR',
  MENTEE = 'MENTEE',
}

@Entity({ name: 'users' })
@Index('idx_users_role_active', ['role', 'isActive'])
export class User extends AuditableEntity {
  @Column({ name: 'name', type: 'varchar', length: 100 })
  name!: string;

  @Index('IDX_users_email', { unique: true })
  @Column({ name: 'email', type: 'varchar', length: 254 })
  email!: string;

  @Column({ name: 'password_hash', type: 'text', select: false })
  passwordHash!: string;

  @Column({
    name: 'role',
    type: 'enum',
    enum: UserRole,
    default: UserRole.MENTEE,
  })
  role!: UserRole;

  @Column({ name: 'token_version', type: 'int', default: 0 })
  tokenVersion!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'must_change_password', type: 'boolean', default: true })
  mustChangePassword!: boolean;

  @Column({
    name: 'last_login_at',
    type: 'timestamptz',
    nullable: true,
  })
  lastLoginAt!: Date | null;
}
