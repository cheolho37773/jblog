const MAX_RETRY_COUNT = 3;

export function isRetryable(attemptCount: number): boolean {
  return attemptCount < MAX_RETRY_COUNT;
}
