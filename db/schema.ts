import {
    integer,
    primaryKey,
    real,
    sqliteTable,
    text,
} from "drizzle-orm/sqlite-core";

// Prezzi OHLC per asset (una riga = un titolo in una data).
// PK composta (ticker, date): senza ticker potresti salvare un solo asset.
export const prices = sqliteTable(
  "prices",
  {
    ticker: text("ticker").notNull(),
    date: text("date").notNull(), // ISO 'YYYY-MM-DD'
    high: real("high").notNull(),
    low: real("low").notNull(),
    close: real("close").notNull(), // adjusted close consigliato
  },
  (t) => [primaryKey({ columns: [t.ticker, t.date] })],
);

// Dati di mercato (VIX): un valore al giorno, condiviso da tutti gli asset.
export const market = sqliteTable("market", {
  date: text("date").primaryKey(), // ISO 'YYYY-MM-DD'
  vix: real("vix").notNull(),
});

// Portafogli dell'utente.
export const portfolios = sqliteTable("portfolios", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  commission_bps: real("commission_bps").notNull().default(0),
  base_fees: real("base_fees").notNull().default(0),
  cash: real("cash").notNull().default(0), // capitale iniziale simulazione
  fees_paid: real("fees_paid").notNull().default(0), // commissioni pagate finora
});

// Composizione: molti holdings per portafoglio.
// PK composta (portfolio_id, ticker): senza, avresti un solo titolo per portafoglio.
export const holdings = sqliteTable(
  "holdings",
  {
    portfolio_id: integer("portfolio_id")
      .notNull()
      .references(() => portfolios.id),
    ticker: text("ticker").notNull(),
    weight: real("weight").notNull(),
    entry_price: real("entry_price").notNull().default(0), // prezzo al momento dell'acquisto
  },
  (t) => [primaryKey({ columns: [t.portfolio_id, t.ticker] })],
);
