import React from "react";

export function LandingAtmosphere() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      <span
        className="absolute -left-48 -top-48 h-[640px] w-[640px] rounded-full blur-[100px] opacity-20"
        style={{
          background: "radial-gradient(circle, #0ea5c6 0%, transparent 70%)",
        }}
      />
      <span
        className="absolute -bottom-48 right-0 h-[540px] w-[540px] rounded-full blur-[100px] opacity-[0.14]"
        style={{
          background: "radial-gradient(circle, #6366f1 0%, transparent 70%)",
        }}
      />
      <span
        className="absolute left-1/2 top-1/3 h-[420px] w-[420px] -translate-x-1/2 rounded-full blur-[80px] opacity-[0.09]"
        style={{
          background: "radial-gradient(circle, #38bdf8 0%, transparent 70%)",
        }}
      />
      <span
        className="absolute bottom-1/4 left-1/4 h-[300px] w-[300px] rounded-full blur-[60px] opacity-[0.06]"
        style={{
          background: "radial-gradient(circle, #f58220 0%, transparent 70%)",
        }}
      />
    </div>
  );
}
