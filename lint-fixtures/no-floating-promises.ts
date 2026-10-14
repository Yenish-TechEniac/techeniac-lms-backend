async function asyncTask(): Promise<void> {
  return Promise.resolve();
}

export function triggerFloatingPromise(): void {
  asyncTask();
}
