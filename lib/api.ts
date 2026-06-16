// lib/api.ts — API 请求封装

export async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(endpoint, options);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
