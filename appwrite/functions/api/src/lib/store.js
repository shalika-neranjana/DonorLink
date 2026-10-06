const { Query } = require('node-appwrite');

/**
 * Thin data-access layer over Appwrite TablesDB. Handlers only talk to this,
 * which keeps them readable and lets tests run against an in-memory fake.
 */
class Store {
  /**
   * @param {{ tablesDB: any, databaseId: string }} deps
   */
  constructor({ tablesDB, databaseId }) {
    this.tablesDB = tablesDB;
    this.databaseId = databaseId;
  }

  async get(tableId, rowId) {
    try {
      return await this.tablesDB.getRow({ databaseId: this.databaseId, tableId, rowId });
    } catch (error) {
      if (error && error.code === 404) return null;
      throw error;
    }
  }

  /** Single page (default 100 rows). */
  async list(tableId, queries = [], limit = 100) {
    const result = await this.tablesDB.listRows({
      databaseId: this.databaseId,
      tableId,
      queries: [...queries, Query.limit(limit)],
    });
    return result.rows;
  }

  /** Follows the cursor until `max` rows or the end. */
  async listAll(tableId, queries = [], max = 500) {
    const rows = [];
    let cursor = null;
    while (rows.length < max) {
      const pageQueries = [...queries, Query.limit(Math.min(100, max - rows.length))];
      if (cursor) pageQueries.push(Query.cursorAfter(cursor));
      const result = await this.tablesDB.listRows({ databaseId: this.databaseId, tableId, queries: pageQueries });
      rows.push(...result.rows);
      if (result.rows.length < 100) break;
      cursor = result.rows[result.rows.length - 1].$id;
    }
    return rows;
  }

  async first(tableId, queries = []) {
    const rows = await this.list(tableId, queries, 1);
    return rows[0] ?? null;
  }

  async count(tableId, queries = []) {
    const result = await this.tablesDB.listRows({
      databaseId: this.databaseId,
      tableId,
      queries: [...queries, Query.limit(1)],
    });
    return result.total ?? result.rows.length;
  }

  create(tableId, rowId, data, permissions) {
    return this.tablesDB.createRow({ databaseId: this.databaseId, tableId, rowId, data, permissions });
  }

  update(tableId, rowId, data, permissions) {
    const params = { databaseId: this.databaseId, tableId, rowId };
    if (data && Object.keys(data).length > 0) params.data = data;
    if (permissions) params.permissions = permissions;
    return this.tablesDB.updateRow(params);
  }

  async remove(tableId, rowId) {
    await this.tablesDB.deleteRow({ databaseId: this.databaseId, tableId, rowId });
  }
}

module.exports = { Store };
