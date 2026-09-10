export const loggerOptions = {
  level: 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      'password',
      'token',
      'secret',
      'databaseUrl',
    ],
    censor: '[REDACTED]',
  },
};
