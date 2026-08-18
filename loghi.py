import requests, os

TICKERS = ["AAPL","MSFT","NVDA","GOOGL","AMZN","META","TSLA","AMD","INTC","CSCO",
  "ORCL","CRM","ADBE","QCOM","TXN","AVGO","NFLX","UBER","SHOP","SONY",
  "JPM","BAC","WFC","GS","MS","V","MA","AXP","BLK","C",
  "JNJ","PFE","UNH","ABBV","MRK","LLY","TMO","NVO",
  "PG","KO","PEP","COST","WMT","MCD","NKE","SBUX",
  "CAT","BA","XOM","CVX"]

APIKEY = ""  # opzionale: metti qui la tua chiave gratuita FMP se serve
os.makedirs("logos", exist_ok=True)

for tk in TICKERS:
    url = f"https://financialmodelingprep.com/image-stock/{tk}.png"
    if APIKEY:
        url += f"?apikey={APIKEY}"
    try:
        r = requests.get(url, timeout=10)
        if r.ok and len(r.content) > 500:      # scarta risposte vuote/errore
            with open(f"logos/{tk}.png", "wb") as f:
                f.write(r.content)
            print("OK", tk)
        else:
            print("manca", tk, r.status_code)
    except Exception as e:
        print("errore", tk, e)