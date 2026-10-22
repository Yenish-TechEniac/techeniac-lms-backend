import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { AuditableEntity } from '../../../core/db';
import { User, UserRole } from './user.entity';

@Entity('user_role_history')
@Index('idx_user_role_history_active', ['userId'], {
  unique: true,
  where: '((to_at IS NULL) AND (deleted_at IS NULL))',
})
export class UserRoleHistory extends AuditableEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 20 })
  role!: UserRole;

  @Column({
    name: 'from_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  fromAt!: Date;

  @Column({ name: 'to_at', type: 'timestamptz', nullable: true })
  toAt!: Date | null;

  @Column({ name: 'changed_by', type: 'uuid', nullable: true })
  changedBy!: string | null;

  @Column({ type: 'varchar', length: 500 })
  reason!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_user_role_history_user_id' })
  user?: User;
}
