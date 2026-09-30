"use client";

import { forwardRef, useImperativeHandle, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "./ui";

export type MentionMember = { id: string; name: string; image?: string | null; designation?: string | null };

/** Converts typed "@Full Name" into stable "<@id>" tokens before saving. */
export function encodeMentions(text: string, members: MentionMember[]) {
  let out = text;
  for (const m of [...members].sort((a, b) => b.name.length - a.name.length)) {
    const escaped = m.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`@${escaped}(?![\\w])`, "g"), `<@${m.id}>`);
  }
  return out;
}

/** Turns stored "<@id>" tokens back into "@Full Name" for editing. */
export function decodeMentions(text: string, members: MentionMember[]) {
  const byId = new Map(members.map((m) => [m.id, m.name]));
  return text.replace(/<@([\w-]+)>/g, (_, id) => `@${byId.get(id) ?? "someone"}`);
}

type Props = {
  value: string;
  onChange: (v: string) => void;
  members: MentionMember[];
  placeholder?: string;
  onSubmit?: () => void;
  className?: string;
  rows?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  /** Enter sends (chat style). Otherwise Cmd/Ctrl+Enter sends. */
  enterToSend?: boolean;
};

export const MentionTextarea = forwardRef<HTMLTextAreaElement, Props>(function MentionTextarea(
  { value, onChange, members, placeholder, onSubmit, className, rows = 2, autoFocus, disabled, enterToSend },
  ref,
) {
  const inner = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => inner.current!);
  const [query, setQuery] = useState<string | null>(null);
  const [start, setStart] = useState(0);
  const [hi, setHi] = useState(0);

  const matches =
    query === null ? [] : members.filter((m) => m.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6);

  function detect(v: string, caret: number) {
    const before = v.slice(0, caret);
    const m = before.match(/(^|\s)@([\w .-]{0,30})$/);
    if (m && !m[2]!.includes("  ")) {
      setQuery(m[2]!);
      setStart(caret - m[2]!.length - 1);
      setHi(0);
    } else setQuery(null);
  }

  function pick(m: MentionMember) {
    const el = inner.current!;
    const caret = el.selectionStart ?? value.length;
    const next = `${value.slice(0, start)}@${m.name} ${value.slice(caret)}`;
    onChange(next);
    setQuery(null);
    requestAnimationFrame(() => {
      const pos = start + m.name.length + 2;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (matches.length) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHi((h) => (h + 1) % matches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHi((h) => (h - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pick(matches[hi]!);
        return;
      }
      if (e.key === "Escape") {
        setQuery(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      if ((enterToSend && !e.shiftKey) || e.metaKey || e.ctrlKey) {
        e.preventDefault();
        onSubmit?.();
      }
    }
  }

  return (
    <div className="relative">
      <textarea
        ref={inner}
        value={value}
        rows={rows}
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          detect(e.target.value, e.target.selectionStart ?? e.target.value.length);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
        className={cn(
          "block w-full resize-none rounded-lg border-0 bg-white px-3 py-2 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-brand-600",
          className,
        )}
      />
      {matches.length ? (
        <div className="absolute bottom-full left-0 z-30 mb-1 w-64 rounded-xl bg-white p-1 shadow-lg ring-1 ring-zinc-200">
          {matches.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                pick(m);
              }}
              className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm", i === hi ? "bg-brand-50" : "hover:bg-zinc-50")}
            >
              <Avatar name={m.name} src={m.image} size={22} />
              <span className="truncate">{m.name}</span>
              {m.designation ? <span className="truncate text-xs text-zinc-400">{m.designation}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
});
