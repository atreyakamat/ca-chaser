import { Suspense } from "react";
import Link from "next/link";
import { AccountCard } from "@/components/app/account-card";
import { NavLinks } from "@/components/app/nav-links";
import { site } from "@/lib/site";
import { logout } from "@/server/actions/auth";

export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="hidden border-r border-border bg-surface lg:flex lg:flex-col lg:gap-6 lg:p-4">
        <Link href="/app" className="px-2 pt-1 text-lg font-semibold tracking-tight">
          {site.name}
        </Link>
        <Suspense>
          <NavLinks />
        </Suspense>
        <div className="mt-auto">
          <Suspense fallback={<div className="h-[62px] rounded-lg border border-border bg-surface" />}>
            <AccountCard />
          </Suspense>
        </div>
      </aside>

      <header className="sticky top-0 z-10 border-b border-border bg-surface/90 px-4 pt-3 pb-2 backdrop-blur lg:hidden">
        <div className="mb-2 flex items-center justify-between">
          <Link href="/app" className="font-semibold tracking-tight">
            {site.name}
          </Link>
          <form action={logout}>
            <button type="submit" className="rounded-md px-2 py-1 text-sm text-muted hover:text-foreground">
              Sign out
            </button>
          </form>
        </div>
        <Suspense>
          <NavLinks orientation="horizontal" />
        </Suspense>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
        <Suspense fallback={<div aria-busy="true" aria-label="Loading" className="h-64 animate-pulse rounded-2xl bg-surface-raised" />}>
          {children}
        </Suspense>
      </main>
    </div>
  );
}
