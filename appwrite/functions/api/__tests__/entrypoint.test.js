/** @jest-environment node */

// The entrypoint (main.js) is the only code that touches `req.bodyJson`, so it
// is tested here rather than through `handle()`.
const mockHandle = jest.fn();
jest.mock('../src/handle', () => ({ handle: (input) => mockHandle(input) }));
jest.mock('../src/lib/store', () => ({ Store: class {} }));
jest.mock('node-appwrite', () => {
  const Client = class {
    setEndpoint() { return this; }
    setProject() { return this; }
    setKey() { return this; }
  };
  return { Client, TablesDB: class {}, Users: class {}, Storage: class {} };
});

const main = require('../src/main');

function run(req) {
  const res = { json: jest.fn((body, status = 200) => ({ body, status })) };
  return main({ req, res, log: jest.fn(), error: jest.fn() }).then(() => res.json.mock.results[0].value);
}

// Mimics the Appwrite runtime, where `bodyJson` throws when the body is empty.
const request = (bodyText, headers = {}) => ({
  headers: { 'x-appwrite-key': 'dynamic-key', ...headers },
  bodyText,
  get bodyJson() {
    return JSON.parse(bodyText);
  },
});

beforeEach(() => {
  mockHandle.mockReset();
  mockHandle.mockResolvedValue({ status: 200, body: { ok: true, data: {} } });
});

describe('function entrypoint', () => {
  it('runs scheduled executions that arrive with an empty body', async () => {
    const result = await run(request('', { 'x-appwrite-trigger': 'schedule' }));
    expect(result.status).toBe(200);
    expect(mockHandle).toHaveBeenCalledWith(expect.objectContaining({ body: {} }));
  });

  it('parses a JSON body', async () => {
    await run(request(JSON.stringify({ action: 'request.create', payload: { a: 1 } })));
    expect(mockHandle).toHaveBeenCalledWith(
      expect.objectContaining({ body: { action: 'request.create', payload: { a: 1 } } }),
    );
  });

  it('rejects a malformed body with 400', async () => {
    const result = await run(request('{not json'));
    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe('bad_request');
    expect(mockHandle).not.toHaveBeenCalled();
  });
});
