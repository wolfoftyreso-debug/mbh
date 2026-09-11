/**
 * Storage abstraction. Files are never at permanently public URLs; every read
 * goes through the authenticated /api/files/[id] route which enforces
 * assignment authorization before streaming bytes from the provider.
 */
export interface StorageProvider {
  readonly name: string;
  put(key: string, data: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
}
