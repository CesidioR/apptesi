"""
Scarica un dataset CAMPIONE (OHLC per asset + VIX) da Yahoo Finance e lo salva
in JSON, pronto per il seed di SQLite nell'app.

Versione ROBUSTA: usa Ticker.history() per-ticker (single-index, niente
MultiIndex fragile di yf.download). Funziona sia in locale sia su Colab.

Output: seed_data.json  con struttura:
    { "prices": [{ "ticker","date","high","low","close" }, ...],
      "market": [{ "date","vix" }, ...] }
"""

PERIOD = "3y"                 # storia per finestre 30/126g (usa "5y" se vuoi piu' dati)
OUT_PATH = "data/prices.json"   # in Colab resta nella working dir


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

    with open(OUT_PATH, "w") as f:
        json.dump({"prices": prices, "market": market}, f)

    print(f"OK -> {OUT_PATH}")
    print(f"  prices: {len(prices)} righe | market: {len(market)} righe")


if __name__ == "__main__":
    main()
