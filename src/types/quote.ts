export type Quote = {
    code: string;
    rawCode: string;
    market: "SH" | "SZ" | "BJ" | "UNKNOWN";
    name: string;
    price: number | null;
    change: number | null;
    changePercent: number | null;
    bid: number | null;
    ask: number | null;
    previousClose: number | null;
    open: number | null;
    high: number | null;
    low: number | null;
    volume: number | null;
    amount: number | null;
    marketTime: string;
    fetchedAt: string;
    source: "sina";
  };
  
  export type QuoteResponse = {
    data: Quote[];
    meta: {
      requested: number;
      returned: number;
      missingCodes: string[];
      stale: boolean;
      cacheTtlSeconds: number;
    };
  };