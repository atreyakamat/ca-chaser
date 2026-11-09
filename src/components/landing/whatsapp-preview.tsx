"use client";

import { motion, useReducedMotion } from "motion/react";

export function WhatsAppPreview() {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 0.96 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="mx-auto w-full max-w-sm rounded-2xl border border-border bg-surface-raised p-4"
      aria-label="Example WhatsApp reminder a client receives"
    >
      <div className="rounded-xl rounded-tl-sm bg-surface p-3 text-sm shadow-sm">
        <p>Hi Rohan, this is Kamat &amp; Associates. Please share your October documents for GST filing:</p>
        <ul className="mt-2 list-inside list-disc text-muted">
          <li>Purchase invoices</li>
          <li>Bank statement</li>
        </ul>
        <p className="mt-2">Upload here, no login needed:</p>
        <p className="mt-1 font-medium text-accent underline underline-offset-2">docchase.in/u/7Kq2…</p>
        <p className="mt-2 text-right text-[11px] text-muted">10:02 am</p>
      </div>
    </motion.div>
  );
}
