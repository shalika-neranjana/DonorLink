const { Client, TablesDB, Users, Storage } = require('node-appwrite');
const { Store } = require('./lib/store');
const { handle } = require('./handle');

/**
 * Appwrite Function entrypoint.
 *
 * Authentication: the caller's identity comes from the x-appwrite-user-id
 * header that Appwrite sets after verifying the session. The server API key is
 * the per-execution dynamic key (x-appwrite-key) limited to the scopes in
 * appwrite/schema.mjs - no long-lived secret is stored in the function.
 */
module.exports = async ({ req, res, log, error }) => {
  const key = req.headers['x-appwrite-key'];
  const databaseId = process.env.DONORLINK_DATABASE_ID || 'donorlink';
  if (!key) {
    error('Missing dynamic API key. Check the function scopes in the console.');
    return res.json({ ok: false, error: { code: 'misconfigured', message: 'Backend is not configured correctly.' } }, 500);
  }

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(key);

  let body = {};
  try {
    body = req.bodyJson || (req.bodyText ? JSON.parse(req.bodyText) : {});
  } catch {
    return res.json({ ok: false, error: { code: 'bad_request', message: 'Request body must be JSON.' } }, 400);
  }

  const result = await handle({
    store: new Store({ tablesDB: new TablesDB(client), databaseId }),
    users: new Users(client),
    storage: new Storage(client),
    headers: req.headers,
    body,
    log: (message) => log(message),
  });
  return res.json(result.body, result.status);
};
