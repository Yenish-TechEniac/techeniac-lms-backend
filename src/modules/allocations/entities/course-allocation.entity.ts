import { Check, Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';

import { AuditableEntity } from '../../../core/db';
import { Batch } from '../../batches';
import { Course } from '../../courses';
import { User } from '../../users';
import { CourseAllocationStatus } from './allocation.enums';
import type { AssignmentDueOverride } from './assignment-due-override.entity';

@Entity({ name: 'course_allocations' })
@Index('uq_ca_one_open_per_course_user', ['courseId', 'userId'], {
  unique: true,
  where: `"status" IN ('ASSIGNED', 'IN_PROGRESS') AND "deleted_at" IS NULL`,
})
@Index('idx_ca_user_status', ['userId', 'status'])
@Index('idx_ca_course_status', ['courseId', 'status'])
@Index('idx_ca_due', ['dueDate'])
@Index('idx_ca_batch', ['batchId'])
@Check('chk_ca_due_after_start', `"due_date" >= "start_date"`)
@Check('chk_ca_percent', `"progress_percent" >= 0 AND "progress_percent" <= 100`)
export class CourseAllocation extends AuditableEntity {
  @Column({ name: 'course_id', type: 'uuid' })
  courseId!: string;

  @ManyToOne(() => Course, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'course_id', foreignKeyConstraintName: 'FK_course_allocations_course_id' })
  course?: Course;

  @Column({ name: 'batch_id', type: 'uuid', nullable: true })
  batchId!: string | null;

  @ManyToOne(() => Batch, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'batch_id', foreignKeyConstraintName: 'FK_course_allocations_batch_id' })
  batch?: Batch | null;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_course_allocations_user_id' })
  user?: User;

  @Column({ name: 'start_date', type: 'timestamptz' })
  startDate!: Date;

  @Column({ name: 'estimated_minutes', type: 'int', nullable: true })
  estimatedMinutes!: number | null;

  @Column({ name: 'due_date', type: 'timestamptz' })
  dueDate!: Date;

  @Column({
    name: 'status',
    type: 'enum',
    enum: CourseAllocationStatus,
    default: CourseAllocationStatus.ASSIGNED,
  })
  status!: CourseAllocationStatus;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({
    name: 'progress_percent',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) =>
        value !== null && value !== undefined ? Number(value) : value,
    },
  })
  progressPercent!: number;

  @OneToMany('AssignmentDueOverride', 'courseAllocation')
  assignmentOverrides?: AssignmentDueOverride[];

  // Computed property
  isOverdue?: boolean;
}
