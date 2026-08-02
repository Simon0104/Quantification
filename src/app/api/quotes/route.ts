import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE_URL =
  process.env.AKSHARE_API_BASE_URL ?? "http://127.0.0.1:8000";

export async function GET(request: NextRequest) {
  const codes = request.nextUrl.searchParams.get("codes")?.trim();

  if (!codes) {
    return NextResponse.json(
      {
        detail: "请至少提供一个股票代码",
      },
      {
        status: 400,
      },
    );
  }

  const backendUrl = new URL("/api/quotes", BACKEND_BASE_URL);
  backendUrl.searchParams.set("codes", codes);

  try {
    const response = await fetch(backendUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    console.error("Failed to fetch quote API:", error);

    return NextResponse.json(
      {
        detail: "行情服务暂时不可用",
      },
      {
        status: 502,
      },
    );
  }
}