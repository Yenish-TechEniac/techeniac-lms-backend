interface DatabaseMock {
  query(sql: string): Promise<unknown>;
  createQueryBuilder(alias: string): unknown;
  getRepository(entity: unknown): unknown;
}

export function executeDirectDatabaseAccess(db: DatabaseMock): void {
  void db.query('SELECT 1');
  void db.createQueryBuilder('user');
  void db.getRepository('User');
}
