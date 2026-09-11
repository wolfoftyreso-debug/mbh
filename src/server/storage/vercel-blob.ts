import { del, get, put } from "@vercel/blob";
import type { StorageProvider } from "./provider";

/**
 * Vercel Blob provider. Blobs are stored with private access and are only ever
 * read server-side; bytes are proxied through the authorized file route so a
 * blob URL is never handed to a browser.
 */
export class VercelBlobStorage implements StorageProvider {
  readonly name = "vercel-blob";

  constructor(private readonly token: string) {}

  private pathname(key: string): string {
    return `humanauth/${key}`;
  }

  async put(key: string, data: Uint8Array, contentType: string): Promise<void> {
    await put(this.pathname(key), Buffer.from(data), {
      access: "private",
      token: this.token,
      contentType,
      addRandomSuffix: false,
    });
  }

  async get(key: string): Promise<Uint8Array | null> {
    const result = await get(this.pathname(key), { access: "private", token: this.token });
    if (!result || result.statusCode !== 200) return null;
    return new Uint8Array(await new Response(result.stream).arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    await del(this.pathname(key), { token: this.token });
  }
}
