"""
Scarica i loghi PNG di tutti i titoli S&P 500 in assets/logos/ e rigenera
src/utils/logos.ts con i require statici (Metro non fa require dinamici).

- Lista S&P500 da Wikipedia (fallback su lista fissa se non risponde).
- Salta i loghi gia' presenti: scarica solo i mancanti.
- I ticker senza logo restano col fallback (cerchio con le 3 lettere) in AssetCard.
"""

import os
import pandas as pd
import requests

LOGO_DIR = "assets/logos"
TS_PATH = "src/utils/logos.ts"
APIKEY = ""  # opzionale: chiave gratuita FMP, se l'endpoint la richiede

FALLBACK = ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AMD", "INTC", "CSCO",
  "ORCL", "CRM", "ADBE", "QCOM", "TXN", "AVGO", "NFLX", "UBER", "SHOP", "SONY",
  "JPM", "BAC", "WFC", "GS", "MS", "V", "MA", "AXP", "BLK", "C",
  "JNJ", "PFE", "UNH", "ABBV", "MRK", "LLY", "TMO", "NVO",
  "PG", "KO", "PEP", "COST", "WMT", "MCD", "NKE", "SBUX",
  "CAT", "BA", "XOM", "CVX"]


def sp500_tickers() -> list[str]:
    try:
        url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
        tables = pd.read_html(url, storage_options={"User-Agent": "Mozilla/5.0"})
        syms = tables[0]["Symbol"].astype(str).tolist()
        tickers = [s.strip().replace(".", "-") for s in syms if s.strip()]
        print(f"S&P500 da Wikipedia: {len(tickers)} titoli")
        return tickers
    except Exception as e:
        print(f"Scraping Wikipedia fallito ({e}); uso fallback di {len(FALLBACK)}")
        return FALLBACK


def download_missing(tickers: list[str]) -> None:
    os.makedirs(LOGO_DIR, exist_ok=True)
    ok, skip, miss = 0, 0, []
    for tk in tickers:
        dst = os.path.join(LOGO_DIR, f"{tk}.png")
        if os.path.exists(dst):
            skip += 1
            continue
        url = f"https://financialmodelingprep.com/image-stock/{tk}.png"
        if APIKEY:
            url += f"?apikey={APIKEY}"
        try:
            r = requests.get(url, timeout=10)
            if r.ok and len(r.content) > 500:  # scarta risposte vuote/errore
                with open(dst, "wb") as f:
                    f.write(r.content)
                ok += 1
            else:
                miss.append(tk)
        except Exception as e:
            print("errore", tk, e)
            miss.append(tk)
    print(f"scaricati: {ok} | gia' presenti: {skip} | senza logo: {len(miss)}")
    if miss:
        print("  senza logo:", ", ".join(miss))


def generate_ts() -> None:
    """Rigenera logos.ts dai file .png presenti in assets/logos/."""
    files = sorted(f[:-4] for f in os.listdir(LOGO_DIR) if f.endswith(".png"))
    lines = [
        "// FILE AUTO-GENERATO da loghi.py — non modificare a mano.",
        "// Mappa ticker -> require statico del PNG (Metro non fa require dinamici).",
        "export const logos: Record<string, any> = {",
    ]
    for tk in files:
        lines.append(f'  {tk_key(tk)}: require("../../assets/logos/{tk}.png"),')
    lines.append("};")
    os.makedirs(os.path.dirname(TS_PATH), exist_ok=True)
    with open(TS_PATH, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"generato {TS_PATH} con {len(files)} loghi")


def tk_key(tk: str) -> str:
    """Chiave JS valida: i ticker con trattino (BRK-B) vanno quotati."""
    return tk if tk.replace("_", "").isalnum() and not tk[0].isdigit() else f'"{tk}"'


if __name__ == "__main__":
    tickers = sp500_tickers()
    download_missing(tickers)
    generate_ts()
