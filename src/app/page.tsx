import { ArrowRight, BellRing, FileUp, LayoutGrid, Lock, Repeat, Smartphone } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { DashboardPreview } from "@/components/landing/dashboard-preview";
import { WhatsAppPreview } from "@/components/landing/whatsapp-preview";
import { site } from "@/lib/site";
import { formatInr, plans } from "@/lib/pricing";
import { cn } from "@/lib/utils";

const steps = [
  { Icon: Repeat, title: "Set it up once", body: "Add your clients and tick which documents each one sends every month. Import from Excel if you have a list." },
  { Icon: BellRing, title: "We chase on schedule", body: "Each client gets a WhatsApp reminder with their own upload link, then polite follow-ups until everything is in." },
  { Icon: LayoutGrid, title: "You see what's missing", body: "One dashboard shows who has sent what. Nudge the late ones in a click, download the rest as a ZIP." },
] as const;

const features = [
  { Icon: Smartphone, title: "No app for your clients", body: "They tap a link, snap a photo or pick a PDF, and they're done. No password, no download." },
  { Icon: FileUp, title: "Built for GST and TDS", body: "Ready-made checklists for sales and purchase invoices, bank statements and TDS challans. Add your own." },
  { Icon: Lock, title: "Private by default", body: "Each link works for one client and one month, then expires. Files are stored privately and only your team can open them." },
] as const;

const faqs = [
  { q: "Do my clients need to install anything?", a: "No. They get a WhatsApp message with a link that opens in their phone's browser. If a client doesn't use WhatsApp, the reminder goes by email." },
  { q: "Does it replace my practice-management software?", a: `No. ${site.name} does one job, collecting documents, and works alongside whatever you already use.` },
  { q: "Which number do the WhatsApp messages come from?", a: "From a verified business number, with your firm's name in every message. Clients who opt out stop getting reminders." },
  { q: "Can I control when reminders go out?", a: "Yes. You choose the day the monthly request goes out and the follow-up schedule before each due date. Reminders stop as soon as a client has sent everything." },
] as const;

export default function Home() {
  const ctaHref = "/signup";

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6" aria-label="Main">
          <a href="#" className="text-lg font-semibold tracking-tight">{site.name}</a>
          <div className="flex items-center gap-1 sm:gap-2">
            <a href="#how" className="hidden rounded-lg px-3 py-2 text-sm text-muted hover:text-foreground sm:inline">How it works</a>
            <a href="#pricing" className="hidden rounded-lg px-3 py-2 text-sm text-muted hover:text-foreground sm:inline">Pricing</a>
            <a href="/login" className="rounded-lg px-3 py-2 text-sm text-muted hover:text-foreground">Sign in</a>
            <ButtonLink href="/signup" size="sm">Get started</ButtonLink>
          </div>
        </nav>
      </header>

      <main id="main" className="flex-1">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-16 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">For CA firms in India</p>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{site.tagline}</h1>
            <p className="mt-5 max-w-xl text-lg text-pretty text-muted">
              {site.name} sends your clients WhatsApp reminders with an upload link every month, follows up until their GST and TDS documents are in, and shows you exactly who is still pending.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={ctaHref} size="lg">
                Get started <ArrowRight aria-hidden />
              </ButtonLink>
              <ButtonLink href="#how" size="lg" variant="secondary">See how it works</ButtonLink>
            </div>
            <p className="mt-4 text-sm text-muted">Plans from {formatInr(plans[0].monthlyInr)} a month. No setup fee.</p>
          </div>
          <DashboardPreview />
        </section>

        <section id="how" className="border-y border-border bg-surface py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-3xl font-semibold tracking-tight">How it works</h2>
            <p className="mt-3 max-w-2xl text-muted">Every month your team spends hours on calls and WhatsApp messages asking for the same documents. Hand that job over.</p>
            <div className="mt-12 grid items-center gap-12 lg:grid-cols-2">
              <ol className="space-y-8">
                {steps.map(({ Icon, title, body }, i) => (
                  <li key={title} className="flex gap-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div>
                      <h3 className="font-semibold"><span className="text-muted">{i + 1}. </span>{title}</h3>
                      <p className="mt-1 text-muted">{body}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <WhatsAppPreview />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight">Does one job, does it well</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {features.map(({ Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-border bg-surface p-6">
                <Icon className="size-5 text-accent" aria-hidden />
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-2 text-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" className="border-y border-border bg-surface py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-3xl font-semibold tracking-tight">Simple monthly pricing</h2>
            <p className="mt-3 text-muted">Priced by how many clients you chase. Prices exclude GST.</p>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={cn(
                    "flex flex-col rounded-2xl border bg-background p-6",
                    plan.highlighted ? "border-accent ring-1 ring-accent" : "border-border",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{plan.name}</h3>
                    {plan.highlighted && <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">Most popular</span>}
                  </div>
                  <p className="mt-4">
                    <span className="text-3xl font-semibold">{formatInr(plan.monthlyInr)}</span>
                    <span className="text-muted"> / month</span>
                  </p>
                  <p className="mt-2 text-sm text-muted">{plan.blurb}</p>
                  <ul className="mt-6 flex-1 space-y-2 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex gap-2"><span className="text-accent" aria-hidden>✓</span>{f}</li>
                    ))}
                  </ul>
                  <ButtonLink href={ctaHref} variant={plan.highlighted ? "primary" : "secondary"} className="mt-6">
                    Get started
                  </ButtonLink>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight">Questions</h2>
          <div className="mt-8 divide-y divide-border border-y border-border">
            {faqs.map(({ q, a }) => (
              <details key={q} className="group py-5">
                <summary className="cursor-pointer list-none font-medium marker:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {q}
                    <span className="text-muted transition-transform group-open:rotate-45" aria-hidden>+</span>
                  </span>
                </summary>
                <p className="mt-3 text-muted">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted sm:flex-row sm:justify-between sm:px-6">
          <p>© {site.name}</p>
          <p>Made in India for CA firms.</p>
        </div>
      </footer>
    </>
  );
}
