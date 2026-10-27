import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { AuditableEntity } from '../../../core/db';
import { CourseAllocation } from '../../allocations';
import { Topic } from '../../courses';
import { TopicProgressStatus } from './progress.enums';

@Entity({ name: 'topic_progress' })
@Index('uq_tp_allocation_topic', ['courseAllocationId', 'topicId'], {
  unique: true,
  where: `"deleted_at" IS NULL`,
})
@Index('idx_tp_allocation_status', ['courseAllocationId', 'status'])
@Index('idx_tp_topic', ['topicId'])
@Index('idx_tp_deadline', ['deadline'])
export class TopicProgress extends AuditableEntity {
  @Column({ name: 'course_allocation_id', type: 'uuid' })
  courseAllocationId!: string;

  @ManyToOne(() => CourseAllocation, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'course_allocation_id',
    foreignKeyConstraintName: 'FK_topic_progress_course_allocation_id',
  })
  courseAllocation?: CourseAllocation;

  @Column({ name: 'topic_id', type: 'uuid' })
  topicId!: string;

  @ManyToOne(() => Topic, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'topic_id',
    foreignKeyConstraintName: 'FK_topic_progress_topic_id',
  })
  topic?: Topic;

  @Column({
    name: 'status',
    type: 'enum',
    enum: TopicProgressStatus,
    default: TopicProgressStatus.NOT_STARTED,
  })
  status!: TopicProgressStatus;

  @Column({ name: 'deadline', type: 'timestamptz', nullable: true })
  deadline!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'note', type: 'text', nullable: true })
  note!: string | null;
}
