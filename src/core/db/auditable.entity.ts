import {
  CreateDateColumn,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export abstract class AuditableEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  updatedAt!: Date;

  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'timestamptz',
    nullable: true,
  })
  deletedAt!: Date | null;
}
