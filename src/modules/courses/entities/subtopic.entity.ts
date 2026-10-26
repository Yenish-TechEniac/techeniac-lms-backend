import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { AuditableEntity } from '../../../core/db';
import { Topic } from './topic.entity';

export interface ResourceItem {
  id?: string;
  title: string;
  url: string;
  type: 'LINK' | 'ATTACHMENT';
}

@Entity({ name: 'subtopics' })
@Index('idx_subtopics_topic_order', ['topicId', 'displayOrder'])
export class Subtopic extends AuditableEntity {
  @Column({ name: 'topic_id', type: 'uuid' })
  topicId!: string;

  @Column({ name: 'title', type: 'varchar', length: 150 })
  title!: string;

  @Column({ name: 'content', type: 'text', nullable: true })
  content!: string | null;

  @Column({ name: 'resources', type: 'jsonb', nullable: true })
  resources!: ResourceItem[] | null;

  @Column({ name: 'display_order', type: 'int' })
  displayOrder!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'estimated_minutes', type: 'int', nullable: true })
  estimatedMinutes!: number | null;

  @ManyToOne(() => Topic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'topic_id' })
  topic?: Topic;
}
