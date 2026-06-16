import Link from "next/link";

export default async function RecordsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground gap-4 px-6 text-center">
      <span className="text-5xl">📊</span>
      <h1 className="text-xl font-semibold">Records</h1>
      <p className="text-warm-500 text-sm max-w-xs">
        Your mood history and journal entries — coming soon.
      </p>
      <Link
        href={`/${locale}`}
        className="px-5 py-2.5 bg-mint-500 text-white rounded-card text-sm font-medium hover:bg-mint-600 transition-colors"
      >
        Back Home
      </Link>
    </div>
  );
}
