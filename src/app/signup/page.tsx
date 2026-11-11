import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/auth-forms";
import { Card } from "@/components/ui/card";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Create account" };

export default function Page() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 block text-center text-lg font-semibold tracking-tight">
          {site.name}
        </Link>
        <Card className="p-6">
          <h1 className="mb-5 text-lg font-semibold">Set up your firm</h1>
          <SignupForm />
        </Card>
        <p className="mt-6 text-center text-sm text-muted">
          Already have an account? <Link href="/login" className="font-medium text-accent underline-offset-2 hover:underline">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
