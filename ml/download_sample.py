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

PERIOD = "3y"                 
OUT_PATH = "data/prices.json"

# Fallback se lo scraping di Wikipedia dovesse fallire (rete, layout cambiato...)
FALLBACK = [
    "A","AAPL","ABBV","ABNB","ABT","ACGL","ACN","ADBE","ADI","ADM","ADP","ADSK","AEE","AEP","AES","AFL","AIG","AIZ","AJG","AKAM",
    "ALB","ALGN","ALL","ALLE","AMAT","AMCR","AMD","AME","AMGN","AMP","AMT","AMZN","ANET","ANSS","AON","AOS","APA","APD","APH","APTV",
    "ARE","ATO","AVB","AVGO","AVY","AWK","AXON","AXP","AZO","BA","BAC","BALL","BAX","BBWI","BBY","BDX","BEN","BF-B","BG","BIIB",
    "BK","BKNG","BKR","BLDR","BLK","BMY","BR","BRK-B","BRO","BSX","BWA","BX","BXP","C","CAG","CAH","CARR","CAT","CB","CBOE",
    "CBRE","CCI","CCL","CDNS","CDW","CE","CEG","CF","CFG","CHD","CHRW","CHTR","CI","CINF","CL","CLX","CMA","CMCSA","CME","CMG",
    "CMI","CMS","CNC","CNP","COF","COO","COP","COR","COST","CPAY","CPB","CPRT","CPT","CRL","CRM","CSCO","CSGP","CSX","CTAS","CTLT",
    "CTRA","CTSH","CTVA","CVS","CVX","CZR","D","DAL","DAY","DD","DE","DECK","DELL","DFS","DG","DGX","DHI","DHR","DIS","DLR",
    "DLTR","DOC","DOV","DOW","DPZ","DRI","DTE","DUK","DVA","DVN","DXCM","EA","EBAY","ECL","ED","EFX","EG","EIX","EL","ELV",
    "EMN","EMR","ENPH","EOG","EPAM","EQIX","EQR","EQT","ERIE","ES","ESS","ETN","ETR","ETSY","EVRG","EW","EXC","EXPD","EXPE","EXR",
    "F","FANG","FAST","FCX","FDS","FDX","FE","FFIV","FI","FICO","FIS","FITB","FLT","FMC","FOX","FOXA","FRT","FSLR","FTNT","FTV",
    "GD","GDDY","GE","GEHC","GEN","GEV","GILD","GIS","GL","GLW","GM","GNRC","GOOG","GOOGL","GPC","GPN","GRMN","GS","GWW","HAL",
    "HAS","HBAN","HCA","HD","HES","HIG","HII","HLT","HOLX","HON","HPE","HPQ","HRL","HSIC","HST","HSY","HUBB","HUM","HWM","IBM",
    "ICE","IDXX","IEX","IFF","INCY","INTC","INTU","INVH","IP","IPG","IQV","IR","IRM","ISRG","IT","ITW","IVZ","J","JBHT","JBL",
    "JCI","JKHY","JNJ","JNPR","JPM","K","KDP","KEY","KEYS","KHC","KIM","KLAC","KMB","KMI","KKR","KMX","KO","KR","KVUE","L",
    "LDOS","LEN","LH","LHX","LIN","LKQ","LLY","LMT","LNT","LOW","LRCX","LULU","LUV","LVS","LW","LYB","LYV","MA","MAA","MAR",
    "MAS","MCD","MCHP","MCK","MCO","MDLZ","MDT","MET","META","MGM","MHK","MKC","MKTX","MLM","MMC","MMM","MNST","MO","MOH","MOS",
    "MPC","MPWR","MRK","MRNA","MS","MSCI","MSFT","MSI","MTB","MTCH","MTD","MU","NCLH","NDAQ","NDSN","NEE","NEM","NFLX","NI","NKE",
    "NOC","NOW","NRG","NSC","NTAP","NTRS","NUE","NVDA","NVR","NWS","NWSA","NXPI","O","ODFL","OKE","OMC","ON","ORCL","ORLY","OTIS",
    "OXY","PANW","PARA","PAYC","PAYX","PCAR","PCG","PEG","PEP","PFE","PFG","PG","PGR","PH","PHM","PKG","PLD","PLTR","PM","PNC",
    "PNR","PNW","PODD","POOL","PPG","PPL","PRU","PSA","PSX","PTC","PWR","PYPL","QCOM","QRVO","RCL","REG","REGN","RF","RHI","RJF",
    "RL","RMD","ROK","ROL","ROP","ROST","RSG","RTX","RVTY","SBAC","SBUX","SCHW","SHW","SJM","SLB","SMCI","SNA","SNPS","SO","SOLV",
    "SPG","SPGI","SRE","STE","STLD","STT","STX","STZ","SWK","SWKS","SYF","SYK","SYY","T","TAP","TDG","TDY","TECH","TEL","TER",
    "TFC","TFX","TGT","TJX","TMO","TMUS","TPR","TRGP","TRMB","TROW","TRV","TSCO","TSLA","TSN","TT","TTWO","TXN","TXT","TYL","UAL",
    "UBER","UDR","UHS","ULTA","UNH","UNP","UPS","URI","USB","V","VICI","VLO","VLTO","VMC","VNO","VRSK","VRSN","VRTX","VST","VTR",
    "VTRS","VZ","WAB","WAT","WBA","WBD","WDC","WEC","WELL","WFC","WM","WMB","WMT","WRB","WST","WTW","WY","WYNN","XEL","XOM",
    "XYL","YUM","ZBH","ZBRA","ZTS",
]

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
