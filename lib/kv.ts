// lib/kv.ts — KV 存储操作封装
// 适配 Vercel KV / Upstash Redis / Cloudflare KV 等

export interface KVStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
}

// TODO: 接入具体 KV 服务后实现
