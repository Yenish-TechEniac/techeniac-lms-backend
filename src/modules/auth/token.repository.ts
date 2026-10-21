import { DataSource, EntityManager, IsNull, LessThan, Repository } from 'typeorm';

import { AppDataSource } from '../../core/db';
import { Token, TokenRevokeReason, TokenType } from './entities/token.entity';

export interface CreateTokenData {
  userId: string;
  tokenType: TokenType;
  jti: string;
  familyId?: string | null;
  replacedById?: string | null;
  tokenVersion?: number | null;
  expiresAt: Date;
}

export class TokenRepository {
  private readonly repo: Repository<Token>;

  constructor(dataSource: DataSource = AppDataSource) {
    this.repo = dataSource.getRepository(Token);
  }

  private getRepo(manager?: EntityManager): Repository<Token> {
    return manager ? manager.getRepository(Token) : this.repo;
  }

  public async createToken(data: CreateTokenData, manager?: EntityManager): Promise<Token> {
    const repo = this.getRepo(manager);
    const token = repo.create({
      userId: data.userId,
      tokenType: data.tokenType,
      jti: data.jti,
      familyId: data.familyId ?? null,
      replacedById: data.replacedById ?? null,
      tokenVersion: data.tokenVersion ?? null,
      expiresAt: data.expiresAt,
      issuedAt: new Date(),
    });
    return repo.save(token);
  }

  public async findByJti(
    jti: string,
    options?: { lock?: boolean; manager?: EntityManager },
  ): Promise<Token | null> {
    const repo = this.getRepo(options?.manager);
    return repo.findOne({
      where: { jti },
      ...(options?.lock ? { lock: { mode: 'pessimistic_write' } } : {}),
    });
  }

  public async revokeByJti(
    jti: string,
    reason: TokenRevokeReason,
    replacedById?: string,
    manager?: EntityManager,
  ): Promise<boolean> {
    const repo = this.getRepo(manager);
    const result = await repo.update(
      { jti, revokedAt: IsNull() },
      {
        revokedAt: new Date(),
        revokedReason: reason,
        ...(replacedById ? { replacedById } : {}),
      },
    );
    return (result.affected ?? 0) > 0;
  }

  public async revokeFamily(
    familyId: string,
    reason: TokenRevokeReason,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = this.getRepo(manager);
    await repo.update(
      { familyId, revokedAt: IsNull() },
      {
        revokedAt: new Date(),
        revokedReason: reason,
      },
    );
  }

  public async revokeAllForUser(
    userId: string,
    reason: TokenRevokeReason,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = this.getRepo(manager);
    await repo.update(
      { userId, revokedAt: IsNull() },
      {
        revokedAt: new Date(),
        revokedReason: reason,
      },
    );
  }

  public async revokeResetTokensForUser(userId: string, manager?: EntityManager): Promise<void> {
    const repo = this.getRepo(manager);
    await repo.update(
      { userId, tokenType: TokenType.PASSWORD_RESET, revokedAt: IsNull() },
      {
        revokedAt: new Date(),
        revokedReason: TokenRevokeReason.PASSWORD_RESET,
      },
    );
  }

  public async markPasswordResetUsed(jti: string, manager?: EntityManager): Promise<void> {
    const repo = this.getRepo(manager);
    await repo.update(
      { jti, revokedAt: IsNull() },
      {
        passwordResetUsedAt: new Date(),
        revokedAt: new Date(),
        revokedReason: TokenRevokeReason.PASSWORD_RESET,
      },
    );
  }

  public async cleanupExpiredTokens(): Promise<number> {
    const result = await this.repo.softDelete({
      expiresAt: LessThan(new Date()),
    });
    return result.affected ?? 0;
  }
}

export const tokenRepository = new TokenRepository();
