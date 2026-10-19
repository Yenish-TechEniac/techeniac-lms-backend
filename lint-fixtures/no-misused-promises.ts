export function triggerMisusedPromise(): void {
  const list = [1, 2, 3];
  list.forEach(async (item) => {
    await Promise.resolve(item);
  });
}
