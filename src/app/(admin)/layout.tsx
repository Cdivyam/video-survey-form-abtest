"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b bg-white px-6 py-3 flex items-center justify-between">
        <Link href="/projects" className="font-semibold text-zinc-900 hover:text-zinc-600">
          AB Test Video Survey
        </Link>
        <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-zinc-800" onClick={logout}>
          Log out
        </Button>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      <Toaster />
    </div>
  );
}
