import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  const res = NextResponse.next();

  /* 从 Accept-Language 解析首选用语言，写入 cookie */
  const cookieLocale = req.cookies.get("locale")?.value;
  if (!cookieLocale) {
    const acceptLang = req.headers.get("accept-language") ?? "";
    const preferred = ["es", "fr"].find((l) => acceptLang.includes(l)) ?? "en";
    res.cookies.set("locale", preferred, { path: "/", maxAge: 86400 * 365 });
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next|api|favicon\\.ico).*)"],
};
