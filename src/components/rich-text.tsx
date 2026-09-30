import { Fragment, type ReactNode } from "react";

const TOKEN = /(<@[\w-]+>|\*\*[^*\n]+\*\*|https?:\/\/[^\s<]+)/g;

/**
 * Renders plain text with a few lightweight conventions:
 * `<@userId>` mentions, `**bold**`, and bare URLs. Everything else is text (no HTML injection).
 */
export function RichText({ text, names }: { text: string; names?: Record<string, string> }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, li) => {
        const parts: ReactNode[] = [];
        let last = 0;
        for (const m of line.matchAll(TOKEN)) {
          const tok = m[0];
          const i = m.index ?? 0;
          if (i > last) parts.push(line.slice(last, i));
          if (tok.startsWith("<@")) {
            const id = tok.slice(2, -1);
            parts.push(
              <span key={i} className="rounded bg-brand-50 px-0.5 font-medium text-brand-700">
                @{names?.[id] ?? "someone"}
              </span>,
            );
          } else if (tok.startsWith("**")) {
            parts.push(<strong key={i}>{tok.slice(2, -2)}</strong>);
          } else {
            parts.push(
              <a key={i} href={tok} target="_blank" rel="noreferrer noopener" className="break-all text-brand-600 underline">
                {tok}
              </a>,
            );
          }
          last = i + tok.length;
        }
        if (last < line.length) parts.push(line.slice(last));
        return (
          <Fragment key={li}>
            {parts}
            {li < lines.length - 1 ? <br /> : null}
          </Fragment>
        );
      })}
    </>
  );
}
