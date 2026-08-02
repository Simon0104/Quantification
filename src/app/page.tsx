"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  MAX_WATCHLIST_SIZE,
  useWatchlist,
} from "@/hooks/use-watchlist";
import type { Quote, QuoteResponse } from "@/types/quote";

const REFRESH_INTERVAL = 5_000;

function formatPrice(value: number | null): string {
  return value === null ? "--" : value.toFixed(2);
}

function formatPercent(value: number | null): string {
  if (value === null) {
    return "--";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatLargeNumber(value: number | null): string {
  if (value === null) {
    return "--";
  }

  if (value >= 100_000_000) {
    return `${(value / 100_000_000).toFixed(2)}亿`;
  }

  if (value >= 10_000) {
    return `${(value / 10_000).toFixed(2)}万`;
  }

  return value.toFixed(0);
}

function changeColor(value: number | null): string {
  if (value === null || value === 0) {
    return "text-slate-500";
  }

  return value > 0 ? "text-red-600" : "text-emerald-600";
}

export default function Home() {
  const { codes, hydrated, addCode, removeCode } = useWatchlist();

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [inputCode, setInputCode] = useState("");
  const [inputError, setInputError] = useState("");
  const [requestError, setRequestError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");

  const loadQuotes = useCallback(async () => {
    if (!hydrated) {
      return;
    }

    if (codes.length === 0) {
      setQuotes([]);
      setLoading(false);
      setRefreshing(false);
      setRequestError("");
      return;
    }

    setRefreshing(true);

    try {
      const response = await fetch(
        `/api/quotes?codes=${encodeURIComponent(codes.join(","))}`,
        {
          cache: "no-store",
        },
      );

      const result = (await response.json()) as
        | QuoteResponse
        | { detail: string };

      if (!response.ok) {
        const message =
          "detail" in result ? result.detail : "获取行情失败";

        throw new Error(message);
      }

      if (!("data" in result)) {
        throw new Error("行情接口返回格式不正确");
      }

      setQuotes(result.data);
      setStale(result.meta.stale);

      if (result.meta.missingCodes.length > 0) {
        setRequestError(
          `未找到股票：${result.meta.missingCodes.join("、")}`,
        );
      } else {
        setRequestError("");
      }

      setLastUpdated(
        result.data[0]?.fetchedAt
          ? new Date(result.data[0].fetchedAt).toLocaleString()
          : "",
      );
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : "行情服务暂时不可用",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [codes, hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
  
    const initialTimer = window.setTimeout(() => {
      void loadQuotes();
    }, 0);
  
    const refreshTimer = window.setInterval(() => {
      void loadQuotes();
    }, REFRESH_INTERVAL);
  
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(refreshTimer);
    };
  }, [hydrated, loadQuotes]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const error = addCode(inputCode);

    if (error) {
      setInputError(error);
      return;
    }

    setInputCode("");
    setInputError("");
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 rounded-2xl bg-slate-950 p-6 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-2 text-sm text-slate-400">
              AKShare · A股行情
            </p>
            <h1 className="text-3xl font-bold">谁是世界上最可爱的小朋友～</h1>
            <p className="mt-2 text-sm text-slate-300">
              行情刷新～
            </p>
          </div>

          <div className="text-sm text-slate-300">
            <p>{refreshing ? "正在刷新…" : "自动刷新已开启"}</p>
            <p className="mt-1">
              更新时间：{lastUpdated || "--"}
            </p>
          </div>
        </header>

        <section className="mb-6 rounded-2xl bg-white p-6 shadow">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold">添加自选股</h2>
              <p className="mt-1 text-sm text-slate-500">
                输入六位A股代码，支持沪市、深市和北交所
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex w-full max-w-xl flex-col gap-2 sm:flex-row"
            >
              <input
                value={inputCode}
                onChange={(event) => {
                  setInputCode(event.target.value);
                  setInputError("");
                }}
                placeholder="例如：600519"
                className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              />

              <button
                type="submit"
                className="rounded-xl bg-slate-950 px-6 py-3 font-medium text-white transition hover:bg-slate-800"
              >
                添加
              </button>
            </form>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="text-slate-500">
              已添加 {codes.length}/{MAX_WATCHLIST_SIZE} 只
            </p>

            {inputError && (
              <p className="text-red-600">{inputError}</p>
            )}
          </div>
        </section>

        {stale && (
          <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-800">
            当前数据为最近一次成功缓存，请留意行情更新时间。
          </div>
        )}

        {requestError && (
          <div className="mb-4 rounded-xl border border-red-300 bg-red-50 p-4 text-red-700">
            {requestError}
          </div>
        )}

        <section className="overflow-hidden rounded-2xl bg-white shadow">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold">我的自选股</h2>
            <span className="text-sm text-slate-500">
              {quotes.length}只
            </span>
          </div>

          {loading ? (
            <div className="p-10 text-center text-slate-500">
              正在获取行情……
            </div>
          ) : quotes.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-lg font-medium text-slate-700">
                暂无自选股
              </p>
              <p className="mt-2 text-sm text-slate-500">
                请在上方输入股票代码进行添加
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-6 py-3">股票</th>
                    <th className="px-4 py-3">最新价</th>
                    <th className="px-4 py-3">涨跌幅</th>
                    <th className="px-4 py-3">涨跌额</th>
                    <th className="px-4 py-3">今开</th>
                    <th className="px-4 py-3">最高</th>
                    <th className="px-4 py-3">最低</th>
                    <th className="px-4 py-3">昨收</th>
                    <th className="px-4 py-3">成交量</th>
                    <th className="px-4 py-3">成交额</th>
                    <th className="px-4 py-3">操作</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {quotes.map((quote) => (
                    <tr key={quote.code} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <p className="font-semibold">{quote.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {quote.market} · {quote.code}
                        </p>
                      </td>

                      <td
                        className={`px-4 py-4 text-lg font-bold ${changeColor(
                          quote.changePercent,
                        )}`}
                      >
                        {formatPrice(quote.price)}
                      </td>

                      <td
                        className={`px-4 py-4 font-semibold ${changeColor(
                          quote.changePercent,
                        )}`}
                      >
                        {formatPercent(quote.changePercent)}
                      </td>

                      <td
                        className={`px-4 py-4 ${changeColor(
                          quote.change,
                        )}`}
                      >
                        {formatPrice(quote.change)}
                      </td>

                      <td className="px-4 py-4">
                        {formatPrice(quote.open)}
                      </td>
                      <td className="px-4 py-4">
                        {formatPrice(quote.high)}
                      </td>
                      <td className="px-4 py-4">
                        {formatPrice(quote.low)}
                      </td>
                      <td className="px-4 py-4">
                        {formatPrice(quote.previousClose)}
                      </td>
                      <td className="px-4 py-4">
                        {formatLargeNumber(quote.volume)}
                      </td>
                      <td className="px-4 py-4">
                        {formatLargeNumber(quote.amount)}
                      </td>

                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => removeCode(quote.code)}
                          className="rounded-lg px-3 py-2 text-red-600 transition hover:bg-red-50"
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}