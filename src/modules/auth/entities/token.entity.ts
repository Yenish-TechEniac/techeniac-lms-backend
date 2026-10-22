import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { AuditableEntity } from '../../../core/db';
import { User } from '../../users';

export enum TokenType {
  REFRESH = 'REFRESH',
  PASSWORD_RESET = 'PASSWORD_RESET',
}

export enum TokenRevokeReason {
  LOGOUT = 'LOGOUT',
  ROTATED = 'ROTATED',
  REUSE_DETECTED = 'REUSE_DETECTED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  PASSWORD_RESET = 'PASSWORD_RESET',
  ROLE_CHANGED = 'ROLE_CHANGED',
  DEACTIVATED = 'DEACTIVATED',
  ADMIN_REVOKED = 'ADMIN_REVOKED',
}

@Entity({ name: 'tokens' })
@Index('idx_tokens_user_type_revoked', ['userId', 'tokenType', 'revokedAt'])
@Index('idx_tokens_family', ['familyId'])
@Index('idx_tokens_expires', ['expiresAt'])
@Check('chk_tokens_expiry', `expires_at > issued_at`)
@Check(
  'chk_tokens_revoked_pair',
  `(revoked_at IS NULL AND revoked_reason IS NULL) OR (revoked_at IS NOT NULL AND revoked_reason IS NOT NULL)`,
)
@Check('chk_tokens_version_required', `token_type = 'PASSWORD_RESET' OR token_version IS NOT NULL`)
@Check('chk_tokens_refresh_family', `token_type <> 'REFRESH' OR family_id IS NOT NULL`)
@Check(
  'chk_tokens_reset_used_only',
  `token_type = 'PASSWORD_RESET' OR password_reset_used_at IS NULL`,
)
export class Token extends AuditableEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_tokens_user_id' })
  user!: User;

  @Column({
    name: 'token_type',
    type: 'enum',
    enum: TokenType,
  })
  tokenType!: TokenType;

  @Index('IDX_tokens_jti', { unique: true })
  @Column({ name: 'jti', type: 'uuid' })
  jti!: string;

  @Column({ name: 'family_id', type: 'uuid', nullable: true })
  familyId!: string | null;

  @Column({ name: 'replaced_by_id', type: 'uuid', nullable: true })
  replacedById!: string | null;

  @ManyToOne(() => Token, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'replaced_by_id',
    foreignKeyConstraintName: 'FK_tokens_replaced_by_id',
  })
  replacedBy!: Token | null;

  @Column({ name: 'token_version', type: 'int', nullable: true })
  tokenVersion!: number | null;

  @Column({
    name: 'issued_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  issuedAt!: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'password_reset_used_at', type: 'timestamptz', nullable: true })
  passwordResetUsedAt!: Date | null;

  @Column({ name: 'last_refreshed_at', type: 'timestamptz', nullable: true })
  lastRefreshedAt!: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({
    name: 'revoked_reason',
    type: 'enum',
    enum: TokenRevokeReason,
    nullable: true,
  })
  revokedReason!: TokenRevokeReason | null;
}
