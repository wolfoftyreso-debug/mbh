import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageProvider } from "./provider";

/** Development-only storage on the local filesystem (outside public/). */
export class LocalDiskStorage implements StorageProvider {
  readonly name = "local";
  constructor(private readonly dir: string) {}

  private resolve(key: string): string {
    const safe = key.replace(/[^a-zA-Z0-9._-]/g, "");
    return path.join(this.dir, safe);
  }

  async put(key: string, data: Uint8Array): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.resolve(key), data);
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      return new Uint8Array(await readFile(this.resolve(key)));
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}
