import { NextRequest, NextResponse } from "next/server";

const locales = ["en", "es", "fr"];
const defaultLocale = "en";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  /* 静态资源 & API 路由放行 */
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/public") ||
    pathname.match(/\.(svg|ico|png|jpg|css|js|woff2)$/)
  ) {
    return NextResponse.next();
  }

  /* 检查 URL 是否已有 locale 前缀 */
  const hasLocale = locales.some(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`),
  );

  if (!hasLocale) {
    /* 从 Accept-Language 或默认英语 */
    const acceptLang = req.headers.get("accept-language") ?? "";
    const preferred =
      locales.find((l) => acceptLang.includes(l)) ?? defaultLocale;
    return NextResponse.redirect(
      new URL(`/${preferred}${pathname === "/" ? "" : pathname}`, req.url),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|public|favicon\\.ico).*)"],
};
