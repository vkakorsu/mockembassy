"use client";

/** Prints the page (or saves it as a PDF from the print dialog). */
export function PrintButton({ label = "Print or save as PDF" }: { label?: string }) {
  return (
    <button onClick={() => window.print()} className="rounded-[3px] border border-ink px-4 py-2 text-sm font-semibold hover:bg-ink hover:text-on-ink">
      {label}
    </button>
  );
}
