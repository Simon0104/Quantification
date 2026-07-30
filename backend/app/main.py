from datetime import datetime
from math import isfinite
from threading import Lock
from time import monotonic
from zoneinfo import ZoneInfo

import akshare as ak
import pandas as pd
from fastapi import FastAPI, HTTPException, Query

app = FastAPI(
    title="A股实时监控 API",
    description="基于 AKShare 的 A 股行情服务",
    version="0.2.0",
)

CACHE_TTL_SECONDS = 15
MAX_CODES = 50

_quote_cache: dict[str, dict] = {}
_last_fetch_time = 0.0
_cache_lock = Lock()


def normalize_code(value: object) -> str:
    """将 sh600519、sz000001、bj920000 统一转换成六位代码。"""
    text = str(value).strip().lower()

    for prefix in ("sh", "sz", "bj"):
        if text.startswith(prefix):
            text = text[len(prefix):]
            break

    return text.zfill(6)


def safe_number(value: object) -> float | None:
    """将DataFrame数值安全转换成JSON可用的浮点数。"""
    if pd.isna(value):
        return None

    try:
        number = float(value)
    except (TypeError, ValueError):
        return None

    return number if isfinite(number) else None


def market_from_code(raw_code: object) -> str:
    code = str(raw_code).strip().lower()

    if code.startswith("sh"):
        return "SH"
    if code.startswith("sz"):
        return "SZ"
    if code.startswith("bj"):
        return "BJ"

    return "UNKNOWN"


def load_market_snapshot() -> dict[str, dict]:
    """从新浪获取沪深京A股全市场行情并转换为统一结构。"""
    dataframe = ak.stock_zh_a_spot()
    fetched_at = datetime.now(ZoneInfo("Asia/Shanghai")).isoformat()

    snapshot: dict[str, dict] = {}

    for row in dataframe.to_dict(orient="records"):
        raw_code = row.get("代码", "")
        code = normalize_code(raw_code)

        snapshot[code] = {
            "code": code,
            "rawCode": str(raw_code),
            "market": market_from_code(raw_code),
            "name": str(row.get("名称", "")),
            "price": safe_number(row.get("最新价")),
            "change": safe_number(row.get("涨跌额")),
            "changePercent": safe_number(row.get("涨跌幅")),
            "bid": safe_number(row.get("买入")),
            "ask": safe_number(row.get("卖出")),
            "previousClose": safe_number(row.get("昨收")),
            "open": safe_number(row.get("今开")),
            "high": safe_number(row.get("最高")),
            "low": safe_number(row.get("最低")),
            "volume": safe_number(row.get("成交量")),
            "amount": safe_number(row.get("成交额")),
            "marketTime": str(row.get("时间戳", "")),
            "fetchedAt": fetched_at,
            "source": "sina",
        }

    if not snapshot:
        raise RuntimeError("新浪行情接口返回空数据")

    return snapshot


def get_market_snapshot() -> tuple[dict[str, dict], bool]:
    """
    获取带缓存的全市场行情。

    返回值中的bool表示数据是否为过期缓存。
    """
    global _quote_cache, _last_fetch_time

    cache_is_fresh = (
        bool(_quote_cache)
        and monotonic() - _last_fetch_time < CACHE_TTL_SECONDS
    )

    if cache_is_fresh:
        return _quote_cache, False

    with _cache_lock:
        cache_is_fresh = (
            bool(_quote_cache)
            and monotonic() - _last_fetch_time < CACHE_TTL_SECONDS
        )

        if cache_is_fresh:
            return _quote_cache, False

        try:
            snapshot = load_market_snapshot()
        except Exception:
            if _quote_cache:
                return _quote_cache, True
            raise

        _quote_cache = snapshot
        _last_fetch_time = monotonic()

        return _quote_cache, False


@app.get("/")
def root() -> dict[str, str]:
    return {
        "message": "A股实时监控 API 正在运行",
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "healthy",
    }


@app.get("/api/quotes")
def get_quotes(
    codes: str = Query(
        ...,
        description="股票代码，以英文逗号分隔，例如：000001,600519",
    ),
) -> dict:
    requested_codes = [
        normalize_code(code)
        for code in codes.split(",")
        if code.strip()
    ]

    requested_codes = list(dict.fromkeys(requested_codes))

    if not requested_codes:
        raise HTTPException(status_code=400, detail="请至少提供一个股票代码")

    if len(requested_codes) > MAX_CODES:
        raise HTTPException(
            status_code=400,
            detail=f"单次最多查询{MAX_CODES}只股票",
        )

    if any(not code.isdigit() or len(code) != 6 for code in requested_codes):
        raise HTTPException(status_code=400, detail="股票代码必须为六位数字")

    try:
        snapshot, stale = get_market_snapshot()
    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail=f"暂时无法获取实时行情：{type(error).__name__}",
        ) from error

    quotes = [
        snapshot[code]
        for code in requested_codes
        if code in snapshot
    ]

    found_codes = {quote["code"] for quote in quotes}
    missing_codes = [
        code for code in requested_codes
        if code not in found_codes
    ]

    return {
        "data": quotes,
        "meta": {
            "requested": len(requested_codes),
            "returned": len(quotes),
            "missingCodes": missing_codes,
            "stale": stale,
            "cacheTtlSeconds": CACHE_TTL_SECONDS,
        },
    }