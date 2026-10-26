import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseEntity } from '../../../core/db';
import { User } from '../../users';
import { Batch } from './batch.entity';
import { BatchStatus } from './batch.enums';

@Entity({ name: 'batch_status_history' })
@Index('idx_bsh_batch_changed', ['batchId', 'changedAt'])
export class BatchStatusHistory extends BaseEntity {
  @Column({ name: 'batch_id', type: 'uuid' })
  batchId!: string;

  @ManyToOne(() => Batch, (batch) => batch.statusHistory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'batch_id', foreignKeyConstraintName: 'FK_batch_status_history_batch_id' })
  batch!: Batch;

  @Column({
    name: 'from_status',
    type: 'enum',
    enum: BatchStatus,
    enumName: 'batches_status_enum',
    nullable: true,
  })
  fromStatus!: BatchStatus | null;

  @Column({
    name: 'to_status',
    type: 'enum',
    enum: BatchStatus,
    enumName: 'batches_status_enum',
  })
  toStatus!: BatchStatus;

  @Column({ name: 'changed_by', type: 'uuid' })
  changedBy!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'changed_by',
    foreignKeyConstraintName: 'FK_batch_status_history_changed_by',
  })
  changer!: User;

  @Column({ name: 'reason', type: 'text', nullable: true })
  reason!: string | null;

  @CreateDateColumn({
    name: 'changed_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  changedAt!: Date;
}
