"use client";
import { useState, useEffect } from "react";

const SUPPORTED = ["es", "fr"];

/** 获取当前语言（优先 cookie → navigator → en） */
function readLocale(): string {
  if (typeof document === "undefined") return "en";
  const match = document.cookie.match(/(?:^|;\s*)locale=([^;]+)/);
  if (match) return match[1];
  const nav = navigator.language.split("-")[0];
  return SUPPORTED.includes(nav) ? nav : "en";
}

/** 设置语言（写 cookie + 刷新当前页） */
export function setLocale(next: string) {
  document.cookie = `locale=${next};path=/;max-age=${86400 * 365}`;
}

/** 客户端 hook：当前语言 */
export function useLocale(): string {
  const [locale, setL] = useState("en");
  useEffect(() => { setL(readLocale()); }, []);
  return locale;
}
