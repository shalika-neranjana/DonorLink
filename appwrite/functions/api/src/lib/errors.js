class ApiError extends Error {
  /**
   * @param {string} code machine-readable code the app can switch on
   * @param {string} message safe, user-presentable message
   * @param {number} status HTTP status
   * @param {Record<string,string>} [fields] per-field validation errors
   */
  constructor(code, message, status = 400, fields) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

const validation = (fields, message = 'Please check the highlighted fields.') =>
  new ApiError('validation_failed', message, 400, fields);
const unauthorized = (message = 'Please sign in to continue.') => new ApiError('unauthorized', message, 401);
const forbidden = (message = 'You do not have permission to do that.') => new ApiError('forbidden', message, 403);
const notFound = (message = 'We could not find that.') => new ApiError('not_found', message, 404);
const conflict = (code, message) => new ApiError(code, message, 409);

module.exports = { ApiError, validation, unauthorized, forbidden, notFound, conflict };
