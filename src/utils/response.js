// src/utils/response.js
/**
 * Standard API response helper.
 * @param {object} res   - Express response object
 * @param {number} status - HTTP status code
 * @param {any}    data   - Payload (object / array / string)
 * @param {string} [message] - Optional human-readable message
 */
const sendResponse = (res, status, data, message) => {
  const body = {
    success: status >= 200 && status < 300,
    data,
  };
  if (message) body.message = message;
  return res.status(status).json(body);
};

export default sendResponse;
