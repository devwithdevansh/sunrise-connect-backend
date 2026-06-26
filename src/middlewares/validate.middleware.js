export const validate = (schema) => (req, res, next) => {
  try {
    if (schema.body) {
      req.body = schema.body.parse(req.body);
    }
    if (schema.query) {
      Object.defineProperty(req, 'query', {
        value: schema.query.parse(req.query),
        writable: true, enumerable: true, configurable: true
      });
    }
    if (schema.params) {
      Object.defineProperty(req, 'params', {
        value: schema.params.parse(req.params),
        writable: true, enumerable: true, configurable: true
      });
    }
    next();
  } catch (error) {
    console.error('Validation Middleware Error:', error);
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: error.errors,
    });
  }
};
