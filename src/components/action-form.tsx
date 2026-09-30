"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { FormError } from "./ui";

export type ActionResult = { ok?: boolean; error?: string; message?: string } | null | undefined | void;

/**
 * Form bound to a server action returning `{ ok } | { error }`.
 * Shows the error inline and calls `onSuccess` (e.g. to close a dialog) when ok.
 */
export function ActionForm({
  action,
  children,
  onSuccess,
  className,
  resetOnSuccess,
}: {
  action: (fd: FormData) => Promise<ActionResult>;
  children: ReactNode;
  onSuccess?: () => void;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(async (_prev: ActionResult, fd: FormData) => {
    const r = await action(fd);
    return r ?? { ok: true };
  }, null);
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);
  useEffect(() => {
    if (state && "ok" in state && state.ok) {
      if (resetOnSuccess) formRef.current?.reset();
      onSuccessRef.current?.();
    }
  }, [state, resetOnSuccess]);
  return (
    <form ref={formRef} action={formAction} className={className ?? "space-y-4"}>
      <FormError message={state && "error" in state ? state.error : null} />
      {state && "message" in state && state.message ? (
        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-200">{state.message}</div>
      ) : null}
      {children}
    </form>
  );
}
