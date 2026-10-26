import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { AuditableEntity } from '../../../core/db';
import { User } from '../../users';
import { Batch } from './batch.entity';
import { BatchMemberRole, BatchReasonToLeave } from './batch.enums';

export { BatchMemberRole, BatchReasonToLeave };

@Entity({ name: 'batch_members' })
@Index('idx_bm_batch_role_active', ['batchId', 'memberRole', 'isActive'])
@Index('idx_bm_user_active', ['userId', 'isActive'])
@Index('uq_bm_one_active_mentee_batch', ['userId'], {
  unique: true,
  where: `"member_role" = 'MENTEE' AND "is_active" = true AND "deleted_at" IS NULL`,
})
@Check(
  'chk_bm_active_left',
  `("is_active" = true AND "left_at" IS NULL) OR ("is_active" = false AND "left_at" IS NOT NULL)`,
)
export class BatchMember extends AuditableEntity {
  @Column({ name: 'batch_id', type: 'uuid' })
  batchId!: string;

  @ManyToOne(() => Batch, (batch) => batch.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'batch_id', foreignKeyConstraintName: 'FK_batch_members_batch_id' })
  batch!: Batch;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_batch_members_user_id' })
  user!: User;

  @Column({
    name: 'member_role',
    type: 'enum',
    enum: BatchMemberRole,
  })
  memberRole!: BatchMemberRole;

  @CreateDateColumn({
    name: 'joined_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  joinedAt!: Date;

  @Column({ name: 'left_at', type: 'timestamptz', nullable: true })
  leftAt!: Date | null;

  @Column({
    name: 'reason_to_leave',
    type: 'enum',
    enum: BatchReasonToLeave,
    nullable: true,
  })
  reasonToLeave!: BatchReasonToLeave | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}
