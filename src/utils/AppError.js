class AppError extends Error {
  /**
   * @param {string} message - Human readable error message.
   * @param {number} statusCode - HTTP status code (e.g., 400, 404, 500).
   * @param {boolean} [isOperational=true] - Flag to indicate expected vs programming errors.
   */
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
