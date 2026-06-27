// Structured API event logging.

function logApiEvent(
  event: string,
  details?: Record<string, string | number | boolean | null>,
) {
  console.info(`[api] ${event}`, {
    timestamp: new Date().toISOString(),
    ...details,
  });
}

export { logApiEvent };
