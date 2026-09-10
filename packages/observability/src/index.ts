export const loggerOptions = {
  level: 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-csrf-token"]',
      'res.headers["set-cookie"]',
      'password',
      'password_hash',
      'token_hash',
      'csrfToken',
      'token',
      'secret',
      'databaseUrl',
    ],
    censor: '[REDACTED]',
  },
};
