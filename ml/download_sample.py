"""
Scarica OHLC per asset + VIX da Yahoo Finance e salva in JSON, pronto per
il seed/sync di SQLite nell'app.

Versione ROBUSTA: Ticker.history() per-ticker (single-index, niente MultiIndex
fragile di yf.download). Funziona in locale, su Colab e in GitHub Actions.

Output: data/prices.json
    { "prices": [{ "ticker","date","high","low","close" }, ...],
      "market": [{ "date","vix" }, ...] }
"""

import json
import os
import yfinance as yf

TICKERS = ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AMD", "INTC", "CSCO",
  "ORCL", "CRM", "ADBE", "QCOM", "TXN", "AVGO", "NFLX", "UBER", "SHOP", "SONY",
  "JPM", "BAC", "WFC", "GS", "MS", "V", "MA", "AXP", "BLK", "C",
  "JNJ", "PFE", "UNH", "ABBV", "MRK", "LLY", "TMO", "NVO",
  "PG", "KO", "PEP", "COST", "WMT", "MCD", "NKE", "SBUX",
  "CAT", "BA", "XOM", "CVX"]
PERIOD = "3y"                 # storia per finestre 30/126g
OUT_PATH = "data/prices.json"


def main():
    prices = []
    for tk in TICKERS:
        h = yf.Ticker(tk).history(period=PERIOD, auto_adjust=True)  # close adjusted
        h = h.dropna(subset=["High", "Low", "Close"])
        for date, r in h.iterrows():
            prices.append({
                "ticker": tk,
                "date": date.strftime("%Y-%m-%d"),
                "high": round(float(r["High"]), 4),
                "low": round(float(r["Low"]), 4),
                "close": round(float(r["Close"]), 4),
            })
        print(f"  {tk}: {len(h)} righe")

    vh = yf.Ticker("^VIX").history(period=PERIOD, auto_adjust=True)
    vh = vh.dropna(subset=["Close"])
    market = [{"date": d.strftime("%Y-%m-%d"), "vix": round(float(r["Close"]), 4)}
              for d, r in vh.iterrows()]

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)  # crea data/ se manca
    with open(OUT_PATH, "w") as f:
        json.dump({"prices": prices, "market": market}, f)

    print(f"OK -> {OUT_PATH}")
    print(f"  prices: {len(prices)} righe | market: {len(market)} righe")


if __name__ == "__main__":
    main()
