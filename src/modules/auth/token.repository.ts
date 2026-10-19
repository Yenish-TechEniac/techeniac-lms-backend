import { DataSource, LessThan, Repository } from 'typeorm';

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

  public async createToken(data: CreateTokenData): Promise<Token> {
    const token = this.repo.create({
      userId: data.userId,
      tokenType: data.tokenType,
      jti: data.jti,
      familyId: data.familyId ?? null,
      replacedById: data.replacedById ?? null,
      tokenVersion: data.tokenVersion ?? null,
      expiresAt: data.expiresAt,
      issuedAt: new Date(),
    });
    return this.repo.save(token);
  }

  public async findByJti(jti: string): Promise<Token | null> {
    return this.repo.findOne({
      where: { jti },
    });
  }

  public async revokeByJti(
    jti: string,
    reason: TokenRevokeReason,
    replacedById?: string,
  ): Promise<void> {
    await this.repo.update(
      { jti },
      {
        revokedAt: new Date(),
        revokedReason: reason,
        ...(replacedById ? { replacedById } : {}),
      },
    );
  }

  public async revokeFamily(familyId: string, reason: TokenRevokeReason): Promise<void> {
    await this.repo.update(
      { familyId },
      {
        revokedAt: new Date(),
        revokedReason: reason,
      },
    );
  }

  public async revokeAllForUser(userId: string, reason: TokenRevokeReason): Promise<void> {
    await this.repo.update(
      { userId },
      {
        revokedAt: new Date(),
        revokedReason: reason,
      },
    );
  }

  public async markPasswordResetUsed(jti: string): Promise<void> {
    await this.repo.update(
      { jti },
      {
        passwordResetUsedAt: new Date(),
        revokedAt: new Date(),
        revokedReason: TokenRevokeReason.PASSWORD_RESET,
      },
    );
  }

  public async cleanupExpiredTokens(): Promise<number> {
    const result = await this.repo.delete({
      expiresAt: LessThan(new Date()),
    });
    return result.affected ?? 0;
  }
}

export const tokenRepository = new TokenRepository();
