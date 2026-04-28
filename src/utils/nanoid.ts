// Crypto-safe random ID (no external dep needed for ID generation)
export function nanoid(size = 21): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  return Array.from(bytes).map((b) => chars[b % chars.length]).join('');
}
