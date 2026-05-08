import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { FAQ } from "./LandingData";

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md transition-colors hover:border-white/15">
      <button
        className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-semibold text-slate-200 transition-colors hover:text-slate-50"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{q}</span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-cyan-400" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
        )}
      </button>
      {open && (
        <div className="border-t border-white/10 px-5 pb-5 pt-3 text-sm leading-relaxed text-slate-400">
          {a}
        </div>
      )}
    </div>
  );
}

export function LandingFaq() {
  return (
    <section id="faq" className="border-t border-white/5 px-6 py-20">
      <div className="mx-auto max-w-2xl">
        <div className="mb-10 text-center">
          <span className="mb-3 inline-block text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">
            FAQ
          </span>
          <h2 className="font-display text-3xl font-black tracking-tight text-slate-50">
            Perguntas frequentes
          </h2>
        </div>
        <div className="flex flex-col gap-3">
          {FAQ.map((item) => (
            <FaqItem key={item.q} {...item} />
          ))}
        </div>
      </div>
    </section>
  );
}
