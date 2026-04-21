import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import AuthGate from "@/components/shared/auth-gate";
import { AuthProvider } from "@/hooks";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Giao diện SCT-ISO.AI",
  description: "Giao diện Next.js cho nền tảng tuân thủ SCT-ISO.AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <Suspense
            fallback={
              <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
                Đang tải…
              </div>
            }
          >
            <AuthGate>{children}</AuthGate>
          </Suspense>
        </AuthProvider>
      </body>
    </html>
  );
}
