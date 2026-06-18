/* 预生成 3 个语言路由，确保 Cloudflare Pages 正确处理动态段 */
export function generateStaticParams() {
  return [{ locale: "en" }, { locale: "es" }, { locale: "fr" }];
}

export default function LocaleLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
