"""
Scarica OHLC per asset + VIX da Yahoo Finance e salva in JSON, pronto per
il seed/sync di SQLite nell'app.

Versione ROBUSTA: Ticker.history() per-ticker (single-index, niente MultiIndex
fragile di yf.download). Funziona in locale, su Colab e in GitHub Actions.

La lista dei titoli e' l'intero S&P 500 (preso da Wikipedia); se Wikipedia non
risponde si ripiega su una lista fissa di 50 titoli, cosi' il workflow non fallisce.

Output: data/prices.json
    { "prices": [{ "ticker","date","high","low","close" }, ...],
      "market": [{ "date","vix" }, ...] }
"""

import gzip
import json
import os
import shutil
import pandas as pd
import yfinance as yf

PERIOD = "3y"                 # storia per finestre 30/126g e grafici
OUT_PATH = "data/prices.json"

# Fallback se lo scraping di Wikipedia dovesse fallire (rete, layout cambiato...)
FALLBACK = ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AMD", "INTC", "CSCO",
  "ORCL", "CRM", "ADBE", "QCOM", "TXN", "AVGO", "NFLX", "UBER", "SHOP", "SONY",
  "JPM", "BAC", "WFC", "GS", "MS", "V", "MA", "AXP", "BLK", "C",
  "JNJ", "PFE", "UNH", "ABBV", "MRK", "LLY", "TMO", "NVO",
  "PG", "KO", "PEP", "COST", "WMT", "MCD", "NKE", "SBUX",
  "CAT", "BA", "XOM", "CVX"]


def sp500_tickers() -> list[str]:
    """Lista completa S&P 500 da Wikipedia. Fallback su FALLBACK in caso di errore."""
    try:
        url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
        # UA esplicito: Wikipedia blocca lo user-agent di default di pandas/requests
        tables = pd.read_html(url, storage_options={"User-Agent": "Mozilla/5.0"})
        syms = tables[0]["Symbol"].astype(str).tolist()
        # yfinance vuole i trattini al posto dei punti: BRK.B -> BRK-B
        tickers = [s.strip().replace(".", "-") for s in syms if s.strip()]
        print(f"S&P500 da Wikipedia: {len(tickers)} titoli")
        return tickers
    except Exception as e:
        print(f"Scraping Wikipedia fallito ({e}); uso lista fallback di {len(FALLBACK)} titoli")
        return FALLBACK


def main():
    tickers = sp500_tickers()

    prices = []
    ok, failed = 0, []
    for tk in tickers:
        try:
            h = yf.Ticker(tk).history(period=PERIOD, auto_adjust=True)  # close adjusted
            h = h.dropna(subset=["High", "Low", "Close"])
            if h.empty:
                failed.append(tk)
                continue
            for date, r in h.iterrows():
                prices.append({
                    "ticker": tk,
                    "date": date.strftime("%Y-%m-%d"),
                    "high": round(float(r["High"]), 4),
                    "low": round(float(r["Low"]), 4),
                    "close": round(float(r["Close"]), 4),
                })
            ok += 1
        except Exception as e:
            print(f"  {tk}: errore ({e})")
            failed.append(tk)

    vh = yf.Ticker("^VIX").history(period=PERIOD, auto_adjust=True)
    vh = vh.dropna(subset=["Close"])
    market = [{"date": d.strftime("%Y-%m-%d"), "vix": round(float(r["Close"]), 4)}
              for d, r in vh.iterrows()]

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)  # crea data/ se manca
    with open(OUT_PATH, "w") as f:
        json.dump({"prices": prices, "market": market}, f)

    # versione compressa: e' quella che scarica l'app (~5-6x piu' piccola)
    with open(OUT_PATH, "rb") as f_in, gzip.open(OUT_PATH + ".gz", "wb") as f_out:
        shutil.copyfileobj(f_in, f_out)

    size_mb = os.path.getsize(OUT_PATH) / (1024 * 1024)
    gz_mb = os.path.getsize(OUT_PATH + ".gz") / (1024 * 1024)
    print(f"\nOK -> {OUT_PATH}  ({size_mb:.1f} MB)  |  {OUT_PATH}.gz  ({gz_mb:.1f} MB)")
    print(f"  titoli ok: {ok} | falliti: {len(failed)}")
    if failed:
        print(f"  falliti: {', '.join(failed)}")
    print(f"  prices: {len(prices)} righe | market: {len(market)} righe")


if __name__ == "__main__":
    main()
