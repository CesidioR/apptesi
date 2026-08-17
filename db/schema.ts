import { sqliteTable, text, real, integer, primaryKey } from 'drizzle-orm/sqlite-core';

// Prezzi OHLC per asset (una riga = un titolo in una data).
// PK composta (ticker, date): senza ticker potresti salvare un solo asset.
export const prices = sqliteTable('prices', {
    ticker: text('ticker').notNull(),
    date: text('date').notNull(),          // ISO 'YYYY-MM-DD'
    high: real('high').notNull(),
    low: real('low').notNull(),
    close: real('close').notNull(),        // adjusted close consigliato
}, (t) => [
    primaryKey({ columns: [t.ticker, t.date] }),
]);

// Dati di mercato (VIX): un valore al giorno, condiviso da tutti gli asset.
export const market = sqliteTable('market', {
    date: text('date').primaryKey(),       // ISO 'YYYY-MM-DD'
    vix: real('vix').notNull(),
});

// Portafogli dell'utente.
export const portfolios = sqliteTable('portfolios', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    commission_bps: real('commission_bps').notNull().default(0),
    cash: real('cash').notNull().default(0),   // capitale iniziale simulazione
});

// Composizione: molti holdings per portafoglio.
// PK composta (portfolio_id, ticker): senza, avresti un solo titolo per portafoglio.
export const holdings = sqliteTable('holdings', {
    portfolio_id: integer('portfolio_id').notNull().references(() => portfolios.id),
    ticker: text('ticker').notNull(),
    weight: real('weight').notNull(),
}, (t) => [
    primaryKey({ columns: [t.portfolio_id, t.ticker] }),
]);
