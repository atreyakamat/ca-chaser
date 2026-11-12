import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth-forms";
import { Card } from "@/components/ui/card";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Sign in" };

export default function Page() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 block text-center text-lg font-semibold tracking-tight">
          {site.name}
        </Link>
        <Card className="p-6">
          <h1 className="mb-5 text-lg font-semibold">Welcome back</h1>
          <LoginForm />
        </Card>
        <p className="mt-6 text-center text-sm text-muted">
          New here? <Link href="/signup" className="font-medium text-accent underline-offset-2 hover:underline">Create an account</Link>
        </p>
      </div>
    </main>
  );
}
