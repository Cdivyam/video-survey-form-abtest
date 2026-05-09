"use client";
import Link from "next/link";
import { Toaster } from "@/components/ui/sonner";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b bg-white px-6 py-3 flex items-center gap-4">
        <Link href="/projects" className="font-semibold text-zinc-900 hover:text-zinc-600">
          AB Test Video Survey
        </Link>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      <Toaster />
    </div>
  );
}
