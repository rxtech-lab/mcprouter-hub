/** Retry the entire check, including dynamic inputs and response assertions. */
export async function retryCheck<T>(check: () => Promise<T>, options: {
  attempts: number;
  delayMs: number;
  onRetry: (attempt: number, error: unknown, delay: number) => void;
}): Promise<{ value: T; attempts: number }> {
  for (let attempt = 1; ; attempt++) {
    try {
      return { value: await check(), attempts: attempt };
    } catch (error) {
      if (attempt >= options.attempts) throw error;
      const delay = options.delayMs * attempt;
      options.onRetry(attempt, error, delay);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
