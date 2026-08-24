import { COLORS } from "@/src/theme";
import { agentStrategy } from "@/src/utils/agentStrategy";
import {
  backtest,
  strategies,
  type BacktestMetrics,
  type Strategy,
} from "@/src/utils/backtest";
import {
  loadMarket,
  loadPortfolioTickers,
  loadPortfolios,
  loadSelectedPrices,
} from "@/src/utils/portfolioMethods";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { CartesianChart, Line } from "victory-native";
import { usePortfolio } from "../context/PortfolioContext";

// tutte le serie: 4 metodi classici + agente ONNX
const SERIES: {
  key: string;
  label: string;
  color: string;
  strategy: Strategy;
}[] = [
  {
    key: "equalWeight",
    label: "Equal Weight",
    color: COLORS.muted,
    strategy: strategies.equalWeight,
  },
  {
    key: "inverseVol",
    label: "Inverse Vol",
    color: COLORS.up,
    strategy: strategies.inverseVol,
  },
  {
    key: "targetVol",
    label: "Target Vol",
    color: COLORS.content,
    strategy: strategies.targetVol,
  },
  {
    key: "kelly",
    label: "Kelly",
    color: COLORS.down,
    strategy: strategies.kelly,
  },
  {
    key: "agent",
    label: "Agente DRL",
    color: COLORS.accent,
    strategy: agentStrategy,
  },
];

// Parametri del backtest regolabili dall'utente.
// commissione e capitale iniziale vengono presi dal portafoglio selezionato.
type OPTS = {
  window: number;
  agentWindow: number;
  rebalanceEvery: number;
  years: number; // durata backtest: anni
  months: number; // durata backtest: mesi
};

type Row = { i: number } & Record<string, number>;

export default function EquityChart() {
  const [data, setData] = useState<Row[] | null>(null);
  const [metrics, setMetrics] = useState<Record<string, BacktestMetrics>>({});
  const [available, setAvailable] = useState<string[]>([]);
  const [period, setPeriod] = useState<{ start: string; end: string } | null>(
    null,
  );

  const { selectedPortfolioId } = usePortfolio();

  const [opts, setOpts] = useState<OPTS>({
    window: 126,
    agentWindow: 30,
    rebalanceEvery: 1,
    years: 3, // default: ~tutto lo storico disponibile
    months: 0,
  });

  // strategia evidenziata (oltre all'equipesato, sempre in evidenza come riferimento)
  const [highlight, setHighlight] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const tks = await loadPortfolioTickers(selectedPortfolioId);
      const allRows = await loadSelectedPrices(tks);
      if (allRows.length === 0) {
        setData([]);
        return;
      }
      // limita i dati alla durata scelta (anni + mesi); 0/0 = tutto lo storico
      const totalDays = opts.years * 365 + opts.months * 30;
      let rows = allRows;
      if (totalDays > 0) {
        const d = new Date(allRows[allRows.length - 1].date);
        d.setDate(d.getDate() - totalDays);
        const cutoff = d.toISOString().slice(0, 10);
        rows = allRows.filter((r) => r.date >= cutoff);
      }
      const market = await loadMarket();

      // commissione e capitale del portafoglio selezionato (fallback ai default)
      const pf = (await loadPortfolios()).find(
        (p) => p.id === selectedPortfolioId,
      );
      const backtestOpts = {
        window: opts.window,
        agentWindow: opts.agentWindow,
        rebalanceEvery: opts.rebalanceEvery,
        commissionBps: pf?.commission_bps ?? 10,
        initialCash: pf?.cash ?? 1,
      };

      const curves: Record<string, number[]> = {};
      const mets: Record<string, BacktestMetrics> = {};

      for (const s of SERIES) {
        try {
          const r = await backtest(rows, market, s.strategy, backtestOpts);
          curves[s.key] = r.equity;
          mets[s.key] = r.metrics;
        } catch (e) {
          console.warn(`Backtest '${s.key}' saltato:`, e);
        }
      }

      const ok = SERIES.filter((s) => curves[s.key]).map((s) => s.key);

      // Periodo effettivo del backtest = intervallo dei dati filtrati.
      // La curva parte dopo la finestra iniziale di `window` giorni.
      const startIdx =
        rows.length > backtestOpts.window ? backtestOpts.window : 0;
      const per =
        rows.length > 0
          ? { start: rows[startIdx].date, end: rows[rows.length - 1].date }
          : null;
      setPeriod(per); // aggiorna SEMPRE il periodo mostrato

      if (ok.length === 0) {
        setAvailable([]);
        setData([]);
        return;
      }

      const len = Math.min(...ok.map((k) => curves[k].length));
      const points: Row[] = [];
      for (let i = 0; i < len; i++) {
        const p: Row = { i };
        ok.forEach((k) => (p[k] = curves[k][i]));
        points.push(p);
      }

      setAvailable(ok);
      setMetrics(mets);
      setData(points);
    })();
  }, [selectedPortfolioId, opts]);

  if (!data) {
    return (
      <View className="h-72 justify-center items-center">
        <ActivityIndicator size="large" color={COLORS.up} />
      </View>
    );
  }

  const pct = (x: number) => (x >= 0 ? "+" : "") + (x * 100).toFixed(1) + "%";
  const shown = SERIES.filter((s) => available.includes(s.key));

  return (
    <View className="w-full">
      <View className="w-full">
        {/* Controlli backtest: durata (anni/mesi) + ribilanciamento */}
        <View className="flex-row gap-2 px-2">
          <View className="flex-1">
            <Text className="text-muted text-xs mb-1">Anni</Text>
            <TextInput
              value={String(opts.years)}
              onChangeText={(t) => {
                const v = parseInt(t.replace(/[^0-9]/g, ""), 10);
                const value = Math.min(3, Math.max(1, v));
                setOpts((p) => ({ ...p, years: isNaN(value) ? 0 : value }));
              }}
              keyboardType="numeric"
              placeholderTextColor={COLORS.muted}
              className="bg-background border border-divider rounded-lg px-3 py-2 text-content"
            />
          </View>
          <View className="flex-1">
            <Text className="text-muted text-xs mb-1">Mesi</Text>
            <TextInput
              value={String(opts.months)}
              onChangeText={(t) => {
                if (opts.years === 3) {
                  return null;
                }
                const v = parseInt(t.replace(/[^0-9]/g, ""), 10);
                const value = Math.min(12, Math.max(1, v));
                setOpts((p) => ({ ...p, months: isNaN(value) ? 0 : value }));
              }}
              keyboardType="numeric"
              placeholderTextColor={COLORS.muted}
              className="bg-background border border-divider rounded-lg px-3 py-2 text-content"
            />
          </View>
          <View className="flex-1">
            <Text className="text-muted text-xs mb-1">Ribil. (gg)</Text>
            <TextInput
              value={String(opts.rebalanceEvery)}
              onChangeText={(text) => {
                const val = parseInt(text.replace(/[^0-9]/g, ""), 10);
                setOpts((prev) => ({
                  ...prev,
                  // fallback a 1 se svuotato (evita divisioni per 0)
                  rebalanceEvery: isNaN(val) || val <= 0 ? 1 : val,
                }));
              }}
              keyboardType="numeric"
              placeholderTextColor={COLORS.muted}
              className="bg-background border border-divider rounded-lg px-3 py-2 text-content"
            />
          </View>
        </View>
        <Text className="text-muted text-[10px] px-2 mt-1 mb-3">
          Durata {opts.years}a {opts.months}m · 0/0 = tutto lo storico
        </Text>
        {period && (
          <Text className="text-muted text-xs text-center mb-1">
            {period.start} → {period.end}
          </Text>
        )}

        {/* Evidenzia una strategia (l'equipesato resta sempre in evidenza) */}
        <Text className="text-muted text-xs px-2 mb-1">Evidenzia</Text>
        <View className="flex-row flex-wrap gap-2 px-2 mb-2">
          {shown
            .filter((s) => s.key !== "equalWeight")
            .map((s) => {
              const sel = highlight === s.key;
              return (
                <Pressable
                  key={s.key}
                  onPress={() => setHighlight(sel ? null : s.key)}
                  className={`px-3 py-1 rounded-full border bg-surface ${
                    sel ? "border-accent" : "border-divider"
                  }`}
                >
                  <Text
                    className="text-xs font-semibold"
                    style={{ color: sel ? s.color : COLORS.muted }}
                  >
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
        </View>

        <View className="h-64 w-full px-2">
          <CartesianChart data={data} xKey="i" yKeys={available}>
            {({ points }) => (
              <>
                {shown.map((s) => {
                  // in evidenza: la strategia scelta + l'equipesato (riferimento).
                  // Se nessuna è scelta, tutte normali.
                  const emphasized =
                    highlight === null ||
                    s.key === highlight ||
                    s.key === "equalWeight";
                  return (
                    <Line
                      key={s.key}
                      points={points[s.key]}
                      // attenua le non evidenziate con alpha (#RRGGBB + "33")
                      color={emphasized ? s.color : s.color + "33"}
                      strokeWidth={s.key === highlight ? 3 : 2}
                      curveType="natural"
                    />
                  );
                })}
              </>
            )}
          </CartesianChart>
        </View>
      </View>
      {/* Tabella comparativa */}
      <View className="mt-4 px-4">
        <View className="flex-row border-b border-divider pb-1">
          <Text className="flex-1 text-muted font-bold text-xs">Strategia</Text>
          <Text className="w-16 text-right text-muted font-bold text-xs">
            Rend
          </Text>
          <Text className="w-14 text-right text-muted font-bold text-xs">
            Sharpe
          </Text>
          <Text className="w-16 text-right text-muted font-bold text-xs">
            MaxDD
          </Text>
        </View>
        {shown.map((s) => {
          const m = metrics[s.key];
          return (
            <View
              key={s.key}
              className="flex-row py-1.5 border-b border-divider items-center"
            >
              <View className="flex-1 flex-row items-center">
                <View
                  className="w-2.5 h-2.5 rounded-full mr-1.5"
                  style={{ backgroundColor: s.color }}
                />
                <Text className="text-content text-xs">{s.label}</Text>
              </View>
              <Text className="w-16 text-right text-content text-xs">
                {m ? pct(m.totalReturn) : "-"}
              </Text>
              <Text className="w-14 text-right text-content text-xs">
                {m ? m.sharpe.toFixed(2) : "-"}
              </Text>
              <Text className="w-16 text-right text-content text-xs">
                {m ? "-" + (m.maxDrawdown * 100).toFixed(1) + "%" : "-"}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
