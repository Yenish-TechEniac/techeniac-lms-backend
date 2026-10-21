import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { User } from '../../users';

export enum AuditType {
  AUTH = 'AUTH',
  USER = 'USER',
  COURSE = 'COURSE',
  BATCH = 'BATCH',
  COURSE_ALLOCATION = 'COURSE_ALLOCATION',
  SUBMISSION = 'SUBMISSION',
  GRADING = 'GRADING',
}

@Entity({ name: 'audit_logs' })
@Index('idx_audit_type', ['type'])
@Index('idx_audit_entity', ['entity', 'entityId'])
@Index('idx_audit_actor_time', ['actorId', 'createdAt'])
@Index('idx_audit_time', ['createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'actor_id', foreignKeyConstraintName: 'FK_audit_logs_actor_id' })
  actor!: User | null;

  @Column({
    name: 'type',
    type: 'enum',
    enum: AuditType,
  })
  type!: AuditType;

  @Column({ name: 'entity', type: 'varchar', length: 100 })
  entity!: string;

  @Column({ name: 'entity_id', type: 'uuid', nullable: true })
  entityId!: string | null;

  @Column({ name: 'action', type: 'varchar', length: 100 })
  action!: string;

  @Column({ name: 'old_value', type: 'jsonb', nullable: true })
  oldValue!: Record<string, unknown> | null;

  @Column({ name: 'new_value', type: 'jsonb', nullable: true })
  newValue!: Record<string, unknown> | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  createdAt!: Date;
}
