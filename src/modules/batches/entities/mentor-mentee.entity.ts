import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { AuditableEntity } from '../../../core/db';
import { User } from '../../users';
import { Batch } from './batch.entity';
import { BatchReasonToLeave } from './batch.enums';

@Entity({ name: 'mentor_mentees' })
@Index('uq_mm_one_active_mentor_per_batch', ['batchId', 'menteeId'], {
  unique: true,
  where: `"is_active" = true AND "deleted_at" IS NULL`,
})
@Index('idx_mm_batch_mentor_active', ['batchId', 'mentorId', 'isActive'])
@Index('idx_mm_mentee_start', ['menteeId', 'startDate'])
@Check('chk_mm_not_self', `"mentor_id" <> "mentee_id"`)
export class MentorMentee extends AuditableEntity {
  @Column({ name: 'batch_id', type: 'uuid' })
  batchId!: string;

  @ManyToOne(() => Batch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'batch_id', foreignKeyConstraintName: 'FK_mentor_mentees_batch_id' })
  batch!: Batch;

  @Column({ name: 'mentor_id', type: 'uuid' })
  mentorId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mentor_id', foreignKeyConstraintName: 'FK_mentor_mentees_mentor_id' })
  mentor!: User;

  @Column({ name: 'mentee_id', type: 'uuid' })
  menteeId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mentee_id', foreignKeyConstraintName: 'FK_mentor_mentees_mentee_id' })
  mentee!: User;

  @CreateDateColumn({
    name: 'start_date',
    type: 'timestamptz',
    default: () => 'now()',
  })
  startDate!: Date;

  @Column({ name: 'end_date', type: 'timestamptz', nullable: true })
  endDate!: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({
    name: 'end_reason',
    type: 'enum',
    enum: BatchReasonToLeave,
    enumName: 'batch_members_reason_to_leave_enum',
    nullable: true,
  })
  endReason!: BatchReasonToLeave | null;

  @Column({ name: 'end_notes', type: 'text', nullable: true })
  endNotes!: string | null;
}
