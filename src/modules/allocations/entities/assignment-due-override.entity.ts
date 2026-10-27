import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { AuditableEntity } from '../../../core/db';
import { Assignment } from '../../courses';
import { User } from '../../users';
import { CourseAllocation } from './course-allocation.entity';

@Entity({ name: 'assignment_due_overrides' })
@Index('uq_ado_allocation_assignment', ['courseAllocationId', 'assignmentId'], {
  unique: true,
  where: `"deleted_at" IS NULL`,
})
export class AssignmentDueOverride extends AuditableEntity {
  @Column({ name: 'course_allocation_id', type: 'uuid' })
  courseAllocationId!: string;

  @ManyToOne(() => CourseAllocation, (ca) => ca.assignmentOverrides, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'course_allocation_id',
    foreignKeyConstraintName: 'FK_ado_course_allocation_id',
  })
  courseAllocation?: CourseAllocation;

  @Column({ name: 'assignment_id', type: 'uuid' })
  assignmentId!: string;

  @ManyToOne(() => Assignment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assignment_id', foreignKeyConstraintName: 'FK_ado_assignment_id' })
  assignment?: Assignment;

  @Column({ name: 'due_date', type: 'timestamptz' })
  dueDate!: Date;

  @Column({ name: 'estimated_minutes', type: 'int', nullable: true })
  estimatedMinutes!: number | null;

  @Column({ name: 'set_by', type: 'uuid' })
  setBy!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'set_by', foreignKeyConstraintName: 'FK_ado_set_by' })
  setter?: User;
}
