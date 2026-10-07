/**
 * In-memory stand-in for Appwrite (TablesDB + Users + Storage) so the real
 * function handlers can be exercised end to end without a network.
 * It evaluates the same Query strings the handlers build with node-appwrite.
 */
const { Store } = require('../../src/lib/store');
const { handle } = require('../../src/handle');

class AppwriteError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const UNIQUE_INDEXES = {
  donations: [['responseId']],
  request_responses: [['requestId', 'donorId']],
};

function matchesQuery(row, query) {
  const { method, attribute, values } = query;
  const v = row[attribute];
  switch (method) {
    case 'equal':
      return values.some((x) => (Array.isArray(v) ? v.includes(x) : v === x));
    case 'notEqual':
      return !values.some((x) => v === x);
    case 'lessThan':
      return v != null && v < values[0];
    case 'lessThanEqual':
      return v != null && v <= values[0];
    case 'greaterThan':
      return v != null && v > values[0];
    case 'greaterThanEqual':
      return v != null && v >= values[0];
    case 'isNull':
      return v == null;
    case 'isNotNull':
      return v != null;
    case 'contains':
      return Array.isArray(v) ? v.includes(values[0]) : String(v ?? '').includes(values[0]);
    default:
      return true;
  }
}

class FakeTablesDB {
  constructor(clock) {
    this.tables = new Map();
    this.clock = clock;
    this.seq = 0;
  }

  table(tableId) {
    if (!this.tables.has(tableId)) this.tables.set(tableId, new Map());
    return this.tables.get(tableId);
  }

  async createRow({ tableId, rowId, data, permissions }) {
    const table = this.table(tableId);
    if (table.has(rowId)) throw new AppwriteError(409, `Row ${rowId} already exists`);
    // Unique indexes from appwrite/schema.mjs that handlers rely on.
    const unique = UNIQUE_INDEXES[tableId] || [];
    for (const columns of unique) {
      const clash = [...table.values()].some((row) => columns.every((c) => row[c] === (data || {})[c]));
      if (clash) throw new AppwriteError(409, `Unique index on ${columns.join(',')} violated`);
    }
    const stamp = this.clock().toISOString();
    const clean = {};
    for (const [k, v] of Object.entries(data || {})) if (v !== undefined) clean[k] = v;
    const row = {
      $id: rowId,
      $sequence: ++this.seq,
      $createdAt: stamp,
      $updatedAt: stamp,
      $permissions: permissions || [],
      ...clean,
    };
    table.set(rowId, row);
    return structuredClone(row);
  }

  async getRow({ tableId, rowId }) {
    const row = this.table(tableId).get(rowId);
    if (!row) throw new AppwriteError(404, 'Row not found');
    return structuredClone(row);
  }

  async updateRow({ tableId, rowId, data, permissions }) {
    const table = this.table(tableId);
    const row = table.get(rowId);
    if (!row) throw new AppwriteError(404, 'Row not found');
    for (const [k, v] of Object.entries(data || {})) if (v !== undefined) row[k] = v;
    if (permissions) row.$permissions = permissions;
    row.$updatedAt = this.clock().toISOString();
    return structuredClone(row);
  }

  async incrementRowColumn({ tableId, rowId, column, value = 1, max }) {
    const row = this.table(tableId).get(rowId);
    if (!row) throw new AppwriteError(404, 'Row not found');
    const next = (row[column] || 0) + value;
    if (max !== undefined && next > max) throw new AppwriteError(400, `Column ${column} would exceed ${max}`);
    row[column] = next;
    row.$updatedAt = this.clock().toISOString();
    return structuredClone(row);
  }

  async decrementRowColumn({ tableId, rowId, column, value = 1, min }) {
    const row = this.table(tableId).get(rowId);
    if (!row) throw new AppwriteError(404, 'Row not found');
    const next = (row[column] || 0) - value;
    if (min !== undefined && next < min) throw new AppwriteError(400, `Column ${column} would go below ${min}`);
    row[column] = next;
    row.$updatedAt = this.clock().toISOString();
    return structuredClone(row);
  }

  async deleteRow({ tableId, rowId }) {
    this.table(tableId).delete(rowId);
  }

  async listRows({ tableId, queries = [] }) {
    const parsed = queries.map((q) => (typeof q === 'string' ? JSON.parse(q) : q));
    let rows = [...this.table(tableId).values()];
    for (const q of parsed) {
      if (['limit', 'offset', 'orderAsc', 'orderDesc', 'cursorAfter', 'select'].includes(q.method)) continue;
      rows = rows.filter((row) => matchesQuery(row, q));
    }
    const order = parsed.find((q) => q.method === 'orderAsc' || q.method === 'orderDesc');
    if (order) {
      const dir = order.method === 'orderAsc' ? 1 : -1;
      rows.sort((a, b) => (a[order.attribute] > b[order.attribute] ? dir : a[order.attribute] < b[order.attribute] ? -dir : 0));
    }
    const total = rows.length;
    const cursor = parsed.find((q) => q.method === 'cursorAfter');
    if (cursor) {
      const index = rows.findIndex((r) => r.$id === cursor.values[0]);
      if (index >= 0) rows = rows.slice(index + 1);
    }
    const offset = parsed.find((q) => q.method === 'offset');
    if (offset) rows = rows.slice(offset.values[0]);
    const limit = parsed.find((q) => q.method === 'limit');
    rows = rows.slice(0, limit ? limit.values[0] : 25);
    return { total, rows: structuredClone(rows) };
  }
}

class FakeUsers {
  constructor() {
    this.map = new Map();
  }

  add(id, { name = id, email = `${id}@example.com`, labels = [], status = true } = {}) {
    this.map.set(id, { $id: id, name, email, labels, status, emailVerification: true, registration: new Date().toISOString() });
    return this.map.get(id);
  }

  async get({ userId }) {
    const user = this.map.get(userId);
    if (!user) throw new AppwriteError(404, 'User not found');
    return structuredClone(user);
  }

  async list({ queries = [], search } = {}) {
    const parsed = queries.map((q) => JSON.parse(q));
    let users = [...this.map.values()];
    for (const q of parsed) {
      if (q.method === 'equal') users = users.filter((u) => q.values.includes(u[q.attribute]));
    }
    if (search) users = users.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase()));
    return { total: users.length, users: structuredClone(users) };
  }

  async updateLabels({ userId, labels }) {
    this.map.get(userId).labels = labels;
  }

  async updateStatus({ userId, status }) {
    this.map.get(userId).status = status;
  }
}

class FakeStorage {
  constructor() {
    this.files = new Map();
  }

  addFile(bucketId, fileId, permissions) {
    this.files.set(`${bucketId}/${fileId}`, { $id: fileId, $permissions: permissions });
  }

  async getFile({ bucketId, fileId }) {
    const file = this.files.get(`${bucketId}/${fileId}`);
    if (!file) throw new AppwriteError(404, 'File not found');
    return file;
  }
}

function createWorld(start = '2026-03-10T10:00:00.000Z') {
  let time = new Date(start).getTime();
  const clock = () => new Date(time);
  const tablesDB = new FakeTablesDB(clock);
  const store = new Store({ tablesDB, databaseId: 'donorlink' });
  const users = new FakeUsers();
  const storage = new FakeStorage();
  const logs = [];

  const world = {
    store,
    users,
    storage,
    logs,
    clock,
    advance(ms) {
      time += ms;
    },
    async call(userId, action, payload = {}, trigger = 'http') {
      const headers = { 'x-appwrite-trigger': trigger };
      if (userId) headers['x-appwrite-user-id'] = userId;
      return handle({ store, users, storage, headers, body: { action, payload }, now: clock, log: (m) => logs.push(m) });
    },
    /** Calls and asserts success, returning data. */
    async ok(userId, action, payload) {
      const result = await world.call(userId, action, payload);
      if (result.status !== 200) {
        throw new Error(`${action} failed: ${result.status} ${JSON.stringify(result.body)}`);
      }
      return result.body.data;
    },
    rows(table) {
      return [...tablesDB.table(table).values()];
    },
  };
  return world;
}

module.exports = { createWorld, AppwriteError };
