import { Check, Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';

import { AuditableEntity } from '../../../core/db';
import { User } from '../../users';
import { BatchStatus } from './batch.enums';
import { BatchMember } from './batch-member.entity';
import { BatchStatusHistory } from './batch-status-history.entity';

export { BatchStatus };

@Entity({ name: 'batches' })
@Index('idx_batches_status', ['status'])
@Index('uq_batches_name_non_archived', { synchronize: false })
@Check('chk_batch_dates', `"start_date" <= "end_date"`)
export class Batch extends AuditableEntity {
  @Column({ name: 'name', type: 'varchar', length: 100 })
  name!: string;

  @Index('uq_batches_code', { unique: true })
  @Column({ name: 'code', type: 'varchar', length: 20 })
  code!: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate!: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate!: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: BatchStatus,
    default: BatchStatus.DRAFT,
  })
  status!: BatchStatus;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by', foreignKeyConstraintName: 'FK_batches_created_by' })
  creator!: User;

  @OneToMany(() => BatchMember, (member) => member.batch)
  members!: BatchMember[];

  @OneToMany(() => BatchStatusHistory, (history) => history.batch)
  statusHistory!: BatchStatusHistory[];
}
