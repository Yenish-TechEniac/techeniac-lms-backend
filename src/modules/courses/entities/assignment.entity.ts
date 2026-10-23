import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { AuditableEntity } from '../../../core/db';
import { Course } from './course.entity';
import type { ResourceItem } from './subtopic.entity';
import { Topic } from './topic.entity';

export enum AssignmentScope {
  COURSE = 'COURSE',
  TOPIC = 'TOPIC',
}

export enum SubmissionMode {
  OFF = 'OFF',
  OPTIONAL = 'OPTIONAL',
  REQUIRED = 'REQUIRED',
}

@Entity({ name: 'assignments' })
@Index('idx_assignments_course_scope', ['courseId', 'scope', 'topicId', 'displayOrder'])
export class Assignment extends AuditableEntity {
  @Column({ name: 'course_id', type: 'uuid' })
  courseId!: string;

  @Column({ name: 'topic_id', type: 'uuid', nullable: true })
  topicId!: string | null;

  @Column({ name: 'scope', type: 'varchar', length: 20 })
  scope!: AssignmentScope;

  @Column({ name: 'display_order', type: 'int' })
  displayOrder!: number;

  @Column({ name: 'title', type: 'varchar', length: 150 })
  title!: string;

  @Column({ name: 'instructions', type: 'text', nullable: true })
  instructions!: string | null;

  @Column({ name: 'estimated_minutes', type: 'int' })
  estimatedMinutes!: number;

  @Column({
    name: 'max_marks',
    type: 'numeric',
    precision: 8,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) =>
        value !== null && value !== undefined ? Number(value) : value,
    },
  })
  maxMarks!: number;

  @Column({
    name: 'pass_marks',
    type: 'numeric',
    precision: 8,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) =>
        value !== null && value !== undefined ? Number(value) : value,
    },
  })
  passMarks!: number;

  @Column({ name: 'allow_late', type: 'boolean', default: false })
  allowLate!: boolean;

  @Column({ name: 'pdf_mode', type: 'varchar', length: 20, default: SubmissionMode.OFF })
  pdfMode!: SubmissionMode;

  @Column({ name: 'zip_mode', type: 'varchar', length: 20, default: SubmissionMode.OFF })
  zipMode!: SubmissionMode;

  @Column({ name: 'url_mode', type: 'varchar', length: 20, default: SubmissionMode.OFF })
  urlMode!: SubmissionMode;

  @Column({ name: 'resources', type: 'jsonb', nullable: true })
  resources!: ResourceItem[] | null;

  @ManyToOne(() => Course, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course?: Course;

  @ManyToOne(() => Topic, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'topic_id' })
  topic?: Topic | null;
}
