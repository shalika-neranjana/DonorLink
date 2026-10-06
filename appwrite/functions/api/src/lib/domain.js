/**
 * Shared domain rules (validation, transitions, matching, permissions...).
 *
 * In the deployed bundle `./../domain` is generated from src/domain by
 * appwrite/package-function.mjs. In Jest, moduleNameMapper points the same
 * specifier at the TypeScript sources.
 */
module.exports = require('../domain');
