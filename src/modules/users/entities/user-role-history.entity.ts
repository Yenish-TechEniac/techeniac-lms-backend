import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

import { AuditableEntity } from '../../../core/db';
import { User, UserRole } from './user.entity';

@Entity('user_role_history')
export class UserRoleHistory extends AuditableEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 20 })
  role!: UserRole;

  @Column({
    name: 'from_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fromAt!: Date;

  @Column({ name: 'to_at', type: 'timestamptz', nullable: true })
  toAt!: Date | null;

  @Column({ name: 'changed_by', type: 'uuid', nullable: true })
  changedBy!: string | null;

  @Column({ type: 'varchar', length: 500 })
  reason!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;
}
