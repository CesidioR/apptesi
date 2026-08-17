import { agentStrategy } from "@/src/utils/agentStrategy";
import {
  backtest,
  type BacktestMetrics,
  type Strategy,
  strategies,
} from "@/src/utils/backtest";
import { loadMarket, loadPrices } from "@/src/utils/portfolioMethods";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { CartesianChart, Line } from "victory-native";

// tutte le serie: 4 metodi classici + agente ONNX
const SERIES: { key: string; label: string; color: string; strategy: Strategy }[] =
  [
    { key: "equalWeight", label: "Equal Weight", color: "#94a3b8", strategy: strategies.equalWeight },
    { key: "inverseVol", label: "Inverse Vol", color: "#22c55e", strategy: strategies.inverseVol },
    { key: "targetVol", label: "Target Vol", color: "#38bdf8", strategy: strategies.targetVol },
    { key: "kelly", label: "Kelly", color: "#f59e0b", strategy: strategies.kelly },
    { key: "agent", label: "Agente DRL", color: "#a855f7", strategy: agentStrategy },
  ];

type Row = { i: number } & Record<string, number>;

export default function EquityChart() {
  const [data, setData] = useState<Row[] | null>(null);
  const [metrics, setMetrics] = useState<Record<string, BacktestMetrics>>({});
  const [available, setAvailable] = useState<string[]>([]);
  const [period, setPeriod] = useState<{ start: string; end: string } | null>(null);

  useEffect(() => {
    (async () => {
      const rows = await loadPrices();
      const market = await loadMarket();

      const curves: Record<string, number[]> = {};
      const mets: Record<string, BacktestMetrics> = {};
      let per: { start: string; end: string } | null = null;

      for (const s of SERIES) {
        try {
          const r = await backtest(rows, market, s.strategy);
          curves[s.key] = r.equity;
          mets[s.key] = r.metrics;
          if (!per && r.dates.length)
            per = { start: r.dates[0], end: r.dates[r.dates.length - 1] };
        } catch (e) {
          console.warn(`Backtest '${s.key}' saltato:`, e);
        }
      }

      const ok = SERIES.filter((s) => curves[s.key]).map((s) => s.key);
      if (ok.length === 0) return;

      const len = Math.min(...ok.map((k) => curves[k].length));
      const points: Row[] = [];
      for (let i = 0; i < len; i++) {
        const p: Row = { i };
        ok.forEach((k) => (p[k] = curves[k][i]));
        points.push(p);
      }

      setAvailable(ok);
      setMetrics(mets);
      setPeriod(per);
      setData(points);
    })();
  }, []);

  if (!data) {
    return (
      <View className="h-72 justify-center items-center">
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  const pct = (x: number) => (x >= 0 ? "+" : "") + (x * 100).toFixed(1) + "%";
  const shown = SERIES.filter((s) => available.includes(s.key));

  return (
    <View className="w-full">
      {period && (
        <Text className="text-slate-500 text-xs text-center mb-1">
          {period.start} → {period.end}
        </Text>
      )}

      <View className="h-64 w-full px-2">
        <CartesianChart data={data} xKey="i" yKeys={available}>
          {({ points }) => (
            <>
              {shown.map((s) => (
                <Line
                  key={s.key}
                  points={points[s.key]}
                  color={s.color}
                  strokeWidth={2}
                  curveType="natural"
                />
              ))}
            </>
          )}
        </CartesianChart>
      </View>

      {/* Tabella comparativa */}
      <View className="mt-4 px-4">
        <View className="flex-row border-b border-slate-600 pb-1">
          <Text className="flex-1 text-slate-400 font-bold text-xs">Strategia</Text>
          <Text className="w-16 text-right text-slate-400 font-bold text-xs">Rend</Text>
          <Text className="w-14 text-right text-slate-400 font-bold text-xs">Sharpe</Text>
          <Text className="w-16 text-right text-slate-400 font-bold text-xs">MaxDD</Text>
        </View>
        {shown.map((s) => {
          const m = metrics[s.key];
          return (
            <View key={s.key} className="flex-row py-1.5 border-b border-slate-800 items-center">
              <View className="flex-1 flex-row items-center">
                <View className="w-2.5 h-2.5 rounded-full mr-1.5" style={{ backgroundColor: s.color }} />
                <Text className="text-white text-xs">{s.label}</Text>
              </View>
              <Text className="w-16 text-right text-slate-200 text-xs">{m ? pct(m.totalReturn) : "-"}</Text>
              <Text className="w-14 text-right text-slate-200 text-xs">{m ? m.sharpe.toFixed(2) : "-"}</Text>
              <Text className="w-16 text-right text-slate-200 text-xs">{m ? "-" + (m.maxDrawdown * 100).toFixed(1) + "%" : "-"}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
