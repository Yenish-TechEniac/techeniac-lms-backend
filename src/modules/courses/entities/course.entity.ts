import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { AuditableEntity } from '../../../core/db';
import { User } from '../../users';
import type { Assignment } from './assignment.entity';
import type { Topic } from './topic.entity';

@Entity({ name: 'courses' })
@Index('idx_courses_active_creator', ['isActive', 'createdBy'])
export class Course extends AuditableEntity {
  @Column({ name: 'title', type: 'varchar', length: 150 })
  title!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'estimated_minutes', type: 'int', nullable: true })
  estimatedMinutes!: number | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator?: User;

  topics?: Topic[];
  assignments?: Assignment[];
  courseAssignments?: Assignment[];
  topicCount?: number;
  assignmentCount?: number;
}
