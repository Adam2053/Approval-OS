"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Fetches JSON from `url` and re-fetches every `interval` ms while the tab is visible.
 * Returns the latest data for the current url and a manual `refresh()`.
 */
export function usePoll<T>(url: string | null, interval = 5000) {
  const [state, setState] = useState<{ url: string | null; data: T | null }>({ url: null, data: null });
  const urlRef = useRef(url);
  useEffect(() => {
    urlRef.current = url;
  }, [url]);

  const refresh = useCallback(async () => {
    const u = urlRef.current;
    if (!u) return;
    try {
      const res = await fetch(u, { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as T;
      if (urlRef.current === u) setState({ url: u, data: json });
    } catch {
      // Network hiccup: keep showing the last good data and try again on the next tick.
    }
  }, []);

  useEffect(() => {
    if (!url) return;
    urlRef.current = url;
    refresh();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, interval);
    const onVis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [url, interval, refresh]);

  const data = state.url === url ? state.data : null;
  return { data, refresh };
}
