/** Client-safe helper: short human-readable fingerprint of a hex hash. */
export function fingerprint(hash: string): string {
  return (hash.slice(0, 16).match(/.{1,4}/g) ?? []).join(" ").toUpperCase();
}
