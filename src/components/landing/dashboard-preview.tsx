"use client";

import { motion, useReducedMotion } from "motion/react";
import { Check, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "received" | "pending" | "overdue";

const docs = ["Sales", "Purchases", "Bank", "TDS"] as const;

// Fictional sample data for the illustration only.
const rows: { client: string; statuses: Status[] }[] = [
  { client: "Shree Ganesh Traders", statuses: ["received", "received", "received", "received"] },
  { client: "Coastal Spices LLP", statuses: ["received", "pending", "received", "pending"] },
  { client: "Fernandes Hardware", statuses: ["overdue", "overdue", "pending", "received"] },
  { client: "Naik Auto Parts", statuses: ["received", "received", "pending", "received"] },
  { client: "Blue Lagoon Cafe", statuses: ["pending", "received", "received", "received"] },
];

const statusStyle: Record<Status, { label: string; className: string; Icon: typeof Check }> = {
  received: { label: "Received", className: "bg-accent-soft text-accent", Icon: Check },
  pending: { label: "Pending", className: "bg-warning-soft text-warning", Icon: Clock },
  overdue: { label: "Overdue", className: "bg-danger-soft text-danger", Icon: AlertCircle },
};

export function DashboardPreview() {
  const reduce = useReducedMotion();

  return (
    <motion.figure
      initial={reduce ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }}
      className="w-full overflow-hidden rounded-2xl border border-border bg-surface shadow-xl shadow-black/5"
      aria-label="Example dashboard showing which clients have sent their documents for October"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-sm font-semibold">October 2026 · GST and TDS</p>
          <p className="text-xs text-muted">Due 11 November</p>
        </div>
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">72% received</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-muted">
              <th scope="col" className="px-4 py-2 font-medium">Client</th>
              {docs.map((doc) => (
                <th key={doc} scope="col" className="px-1 py-2 text-center font-medium sm:px-2">{doc}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <motion.tr
                key={row.client}
                initial={reduce ? false : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: 0.35 + i * 0.08 }}
                className="border-t border-border"
              >
                <th scope="row" className="max-w-[9rem] truncate px-4 py-2.5 font-medium sm:max-w-none">{row.client}</th>
                {row.statuses.map((status, j) => {
                  const { label, className, Icon } = statusStyle[status];
                  return (
                    <td key={docs[j]} className="px-1 py-2.5 text-center sm:px-2">
                      <span className={cn("inline-flex size-7 items-center justify-center rounded-full", className)} title={label}>
                        <Icon className="size-3.5" aria-hidden />
                        <span className="sr-only">{label}</span>
                      </span>
                    </td>
                  );
                })}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.figure>
  );
}
