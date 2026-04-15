import Link from "next/link";

export default function Home() {
  const pages = [
    { href: "/dashboard", label: "Bảng điều khiển" },
    { href: "/document-control", label: "Quản lý tài liệu" },
    { href: "/haccp-compliance", label: "Tuân thủ HACCP" },
    { href: "/capa-management", label: "Quản lý CAPA" },
    { href: "/prp-audit", label: "Đánh giá PRP" },
    { href: "/ai-analytics", label: "Phân tích AI" },
    { href: "/reports", label: "Báo cáo" },
    { href: "/user-management", label: "Quản lý người dùng" },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-cyan-800 via-cyan-700 to-cyan-500 p-8 text-white">
      <div className="mx-auto max-w-5xl rounded-2xl border border-white/20 bg-white/10 p-8 backdrop-blur-sm">
        <h1 className="text-3xl font-bold">Giao diện SCT-ISO.AI (Next.js)</h1>
        <p className="mt-2 text-white/90">
          Chọn màn hình để truy cập các module đã được đưa vào Next.js.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pages.map((page) => (
            <Link
              key={page.href}
              href={page.href}
              className="rounded-xl border border-white/30 bg-white/15 px-4 py-3 font-semibold transition hover:bg-white/25"
            >
              {page.label}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
