import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { AuditableEntity } from '../../../core/db';
import type { Assignment } from './assignment.entity';
import { Course } from './course.entity';
import type { ResourceItem, Subtopic } from './subtopic.entity';

@Entity({ name: 'topics' })
@Index('idx_topics_course_order', ['courseId', 'displayOrder'])
export class Topic extends AuditableEntity {
  @Column({ name: 'course_id', type: 'uuid' })
  courseId!: string;

  @Column({ name: 'title', type: 'varchar', length: 150 })
  title!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'resources', type: 'jsonb', nullable: true })
  resources!: ResourceItem[] | null;

  @Column({ name: 'display_order', type: 'int' })
  displayOrder!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'estimated_minutes', type: 'int', nullable: true })
  estimatedMinutes!: number | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy!: string | null;

  @ManyToOne(() => Course, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course?: Course;

  subtopics?: Subtopic[];
  assignments?: Assignment[];
}
