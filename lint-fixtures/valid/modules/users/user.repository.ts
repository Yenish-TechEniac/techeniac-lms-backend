import { DataSource } from 'typeorm';

export class UserRepository {
  constructor(private readonly dataSource: DataSource) {}

  public async findUsers(): Promise<unknown> {
    return await this.dataSource.query('SELECT * FROM users');
  }
}

