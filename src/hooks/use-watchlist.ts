"use client";

import {
  useCallback,
  useMemo,
  useSyncExternalStore,
} from "react";

const STORAGE_KEY = "a-share-watchlist";
const CHANGE_EVENT = "a-share-watchlist-change";
const DEFAULT_CODES = ["000001", "600519"];
const DEFAULT_SNAPSHOT = JSON.stringify(DEFAULT_CODES);

export const MAX_WATCHLIST_SIZE = 50;

function normalizeCode(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^(sh|sz|bj)/, "");
}

function isValidCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function getClientSnapshot(): string {
  return window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_SNAPSHOT;
}

function getServerSnapshot(): string {
  return DEFAULT_SNAPSHOT;
}

function parseCodes(snapshot: string): string[] {
  try {
    const parsedValue: unknown = JSON.parse(snapshot);

    if (!Array.isArray(parsedValue)) {
      return DEFAULT_CODES;
    }

    const validCodes = parsedValue
      .filter(
        (value): value is string =>
          typeof value === "string" &&
          isValidCode(normalizeCode(value)),
      )
      .map(normalizeCode);

    return Array.from(new Set(validCodes)).slice(
      0,
      MAX_WATCHLIST_SIZE,
    );
  } catch {
    return DEFAULT_CODES;
  }
}

function saveCodes(codes: string[]): void {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(codes),
  );

  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useWatchlist() {
  const snapshot = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  const codes = useMemo(
    () => parseCodes(snapshot),
    [snapshot],
  );

  const addCode = useCallback(
    (input: string): string | null => {
      const code = normalizeCode(input);

      if (!isValidCode(code)) {
        return "请输入六位股票代码，例如：600519";
      }

      if (codes.includes(code)) {
        return "该股票已在自选股中";
      }

      if (codes.length >= MAX_WATCHLIST_SIZE) {
        return `最多只能添加${MAX_WATCHLIST_SIZE}只自选股`;
      }

      saveCodes([...codes, code]);

      return null;
    },
    [codes],
  );

  const removeCode = useCallback(
    (code: string) => {
      saveCodes(codes.filter((item) => item !== code));
    },
    [codes],
  );

  return {
    codes,
    hydrated: true,
    addCode,
    removeCode,
  };
}