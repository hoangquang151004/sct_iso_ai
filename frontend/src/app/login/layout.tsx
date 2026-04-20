import { Suspense } from "react";

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#eef6fa] text-slate-600">
          Đang tải…
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
