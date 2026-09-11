import { env } from "@/lib/config/env";
import type { StorageProvider } from "./provider";
import { DatabaseStorage } from "./database";
import { LocalDiskStorage } from "./local";
import { VercelBlobStorage } from "./vercel-blob";

let instance: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (instance) return instance;
  switch (env.STORAGE_PROVIDER) {
    case "vercel-blob":
      if (!env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN is required for the vercel-blob storage provider");
      instance = new VercelBlobStorage(env.BLOB_READ_WRITE_TOKEN);
      break;
    case "local":
      instance = new LocalDiskStorage(env.STORAGE_LOCAL_DIR);
      break;
    default:
      instance = new DatabaseStorage();
  }
  return instance;
}

export type { StorageProvider };
