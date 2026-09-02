import { COLORS } from "@/src/theme";
import {
  computeMethodPlan,
  loadHoldings,
  WEIGHT_METHOD_LABEL,
  type WeightMethod,
} from "@/src/utils/portfolioMethods";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { usePortfolio } from "../context/PortfolioContext";

type WeightItem = { ticker: string; weight: number };
type MethodPlan = { method: WeightMethod; items: WeightItem[] };

const METHODS: WeightMethod[] = [
  "equal",
  "inverseVol",
  "targetVol",
  "kelly",
  "agent",
];

const fmtPct = (w: number) => (w * 100).toFixed(1) + "%";

// Colore stabile per ticker (angolo aureo → tinte ben distinte).
function colorForIndex(i: number): string {
  return `hsl(${(i * 137.5) % 360}, 65%, 55%)`;
}

// Barra impilata: un segmento per titolo (largo quanto il peso) + residuo = contante.
function StackedBar({
  items,
  colorOf,
}: {
  items: WeightItem[];
  colorOf: (t: string) => string;
}) {
  const sum = items.reduce((s, it) => s + Math.max(0, it.weight), 0);
  const residual = Math.max(0, 1 - sum); // parte non investita (contante)
  return (
    <View className="flex-row h-4 rounded-full overflow-hidden bg-surface border border-divider">
      {items
        .filter((it) => it.weight > 0)
        .map((it) => (
          <View
            key={it.ticker}
            style={{ flex: it.weight, backgroundColor: colorOf(it.ticker) }}
          />
        ))}
      {residual > 0.0001 && (
        <View style={{ flex: residual, backgroundColor: COLORS.divider }} />
      )}
    </View>
  );
}

export default function WeightsBreakdown() {
  const { selectedPortfolioId, refreshToken } = usePortfolio();
  const [current, setCurrent] = useState<WeightItem[]>([]);
  const [plans, setPlans] = useState<MethodPlan[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedPortfolioId == null) {
      setCurrent([]);
      setPlans([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const hold = await loadHoldings(selectedPortfolioId);
        if (!cancelled) setCurrent(hold);

        // pesi che OGNI metodo assegnerebbe (salta quelli non calcolabili)
        const results: MethodPlan[] = [];
        for (const m of METHODS) {
          try {
            const plan = await computeMethodPlan(selectedPortfolioId, m);
            results.push({ method: m, items: plan.items });
          } catch {
            // metodo saltato (es. dati insufficienti o modello non pronto)
          }
        }
        if (!cancelled) setPlans(results);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedPortfolioId, refreshToken]);

  // mappa colore stabile su tutti i ticker (attuali + di ogni metodo)
  const colorOf = useMemo(() => {
    const set = new Set<string>();
    current.forEach((c) => set.add(c.ticker));
    plans.forEach((p) => p.items.forEach((it) => set.add(it.ticker)));
    const list = [...set].sort();
    const map = new Map(list.map((t, i) => [t, colorForIndex(i)]));
    return (t: string) => map.get(t) ?? COLORS.muted;
  }, [current, plans]);

  if (selectedPortfolioId == null) return null;

  const hasTickers = current.length > 0;

  return (
    <View className="mt-6">
      {/* Allocazione attuale */}
      <Text className="text-content font-semibold mb-2">Allocazione attuale</Text>
      {!hasTickers ? (
        <Text className="text-muted text-xs">
          Nessun titolo nel portafoglio. Aggiungine dalla scheda Assets.
        </Text>
      ) : (
        <>
          <StackedBar items={current} colorOf={colorOf} />
          {/* Stampa dei pesi attuali */}
          <View className="flex-row flex-wrap gap-x-3 gap-y-1 mt-2">
            {current
              .filter((c) => c.weight > 0)
              .sort((a, b) => b.weight - a.weight)
              .map((c) => (
                <View key={c.ticker} className="flex-row items-center">
                  <View
                    className="w-2.5 h-2.5 rounded-full mr-1"
                    style={{ backgroundColor: colorOf(c.ticker) }}
                  />
                  <Text className="text-content text-xs">
                    {c.ticker} {fmtPct(c.weight)}
                  </Text>
                </View>
              ))}
            {current.every((c) => c.weight === 0) && (
              <Text className="text-muted text-xs">
                Pesi non ancora assegnati — scegli un metodo di allocazione.
              </Text>
            )}
          </View>
        </>
      )}

      {/* Pesi per metodo */}
      {hasTickers && (
        <>
          <Text className="text-content font-semibold mt-5 mb-2">
            Pesi per metodo
          </Text>
          {loading && plans.length === 0 ? (
            <ActivityIndicator color={COLORS.up} className="my-2 self-start" />
          ) : (
            plans.map((p) => (
              <View key={p.method} className="mb-3">
                <Text className="text-muted text-xs mb-1">
                  {WEIGHT_METHOD_LABEL[p.method]}
                </Text>
                <StackedBar items={p.items} colorOf={colorOf} />
              </View>
            ))
          )}
        </>
      )}
    </View>
  );
}
