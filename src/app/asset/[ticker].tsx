import { loadSelectedPrices } from "@/src/utils/portfolioMethods";
import { logos } from "@/src/utils/logos";
import type { PriceRow } from "@/src/utils/finance";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { G, Line, Rect } from "react-native-svg";

const GREEN = "#22c55e";
const RED = "#ef4444";
const CANDLES = 40; // quante candele mostrare nel grafico

/* --------------------------- Grafico a candele --------------------------- */
// Il DB non ha il prezzo di apertura: lo approssimo con il close del giorno
// precedente (convenzione comune per serie solo-close).
function CandleChart({ rows }: { rows: PriceRow[] }) {
  const [w, setW] = useState(320);
  const H = 150;

  const candles = rows.slice(-CANDLES);
  if (candles.length < 2) return null;

  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const max = Math.max(...highs);
  const min = Math.min(...lows);
  const range = max - min || 1;

  const y = (price: number) => H - ((price - min) / range) * H;
  const slot = w / candles.length;
  const bodyW = Math.max(2, slot * 0.6);

  return (
    <View
      className="w-full"
      style={{ height: H }}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
    >
      <Svg width={w} height={H}>
        {candles.map((c, i) => {
          const open = i === 0 ? c.close : candles[i - 1].close;
          const up = c.close >= open;
          const color = up ? GREEN : RED;
          const cx = i * slot + slot / 2;
          const yOpen = y(open);
          const yClose = y(c.close);
          const top = Math.min(yOpen, yClose);
          const bodyH = Math.max(1, Math.abs(yClose - yOpen));
          return (
            <G key={c.date}>
              {/* stoppino: dal massimo al minimo */}
              <Line
                x1={cx}
                x2={cx}
                y1={y(c.high)}
                y2={y(c.low)}
                stroke={color}
                strokeWidth={1}
              />
              {/* corpo: da open a close */}
              <Rect
                x={cx - bodyW / 2}
                y={top}
                width={bodyW}
                height={bodyH}
                rx={1}
                fill={color}
              />
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

/* ----------------------------- Riga informazione ----------------------------- */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-2">
      <Text className="text-slate-500">{label}</Text>
      <Text className="text-slate-900 font-semibold">{value}</Text>
    </View>
  );
}

/* -------------------------------- Schermata -------------------------------- */
export default function AssetDetailScreen() {
  const { ticker } = useLocalSearchParams<{ ticker: string }>();
  const router = useRouter();
  const [rows, setRows] = useState<PriceRow[] | null>(null);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!ticker) return;
    loadSelectedPrices([ticker]).then((r) =>
      setRows(r.sort((a, b) => a.date.localeCompare(b.date))),
    );
  }, [ticker]);

  // metriche derivate dai prezzi reali
  const stats = useMemo(() => {
    if (!rows || rows.length < 2) return null;
    const window = rows.slice(-CANDLES);
    const last = window.at(-1)!.close;
    const first = window[0].close;
    const changeAbs = last - first;
    const changePct = first ? (changeAbs / first) * 100 : 0;
    return { last, entry: first, changeAbs, changePct, up: changeAbs >= 0 };
  }, [rows]);

  if (!rows || !stats) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color={GREEN} />
      </SafeAreaView>
    );
  }

  const { last, entry, changeAbs, changePct, up } = stats;
  const badgeColor = up ? GREEN : RED;
  const bookValue = entry * qty;

  return (
    <>
      {/* nascondo l'header di default: ne uso uno personalizzato */}
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={up ? ["#dcfce7", "#f0fdf4", "#ffffff"] : ["#fee2e2", "#fef2f2", "#ffffff"]}
        locations={[0, 0.35, 1]}
        style={{ flex: 1 }}
      >
        <SafeAreaView className="flex-1" edges={["top"]}>
          {/* Header: indietro + ticker */}
          <View className="flex-row items-center px-4 py-2">
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              className="w-10 h-10 rounded-full items-center justify-center"
            >
              <Text className="text-2xl text-slate-800">←</Text>
            </Pressable>
            <Text className="text-lg font-semibold text-slate-900 ml-1">
              {ticker}
            </Text>
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Logo + prezzo + variazione */}
            <View className="items-center mt-2 mb-4">
              {logos[ticker] ? (
                <Image
                  source={logos[ticker]}
                  className="w-16 h-16 rounded-full"
                  resizeMode="contain"
                />
              ) : (
                <View className="w-16 h-16 rounded-full bg-slate-200 items-center justify-center">
                  <Text className="text-slate-600 font-bold">
                    {ticker?.slice(0, 3)}
                  </Text>
                </View>
              )}
              <Text className="text-4xl font-bold text-slate-900 mt-3">
                {last.toFixed(2)}
              </Text>
              <View
                className="rounded-full px-3 py-1 mt-2"
                style={{ backgroundColor: up ? "#dcfce7" : "#fee2e2" }}
              >
                <Text style={{ color: badgeColor }} className="font-semibold">
                  {up ? "+" : ""}
                  {changeAbs.toFixed(2)} ({up ? "+" : ""}
                  {changePct.toFixed(2)}%)
                </Text>
              </View>
            </View>

            {/* Pulsanti Compra / Vendi */}
            <View className="flex-row gap-3 mb-4">
              <Pressable className="flex-1 bg-violet-600 rounded-full py-4 items-center active:opacity-80">
                <Text className="text-white font-semibold">Compra ↙</Text>
              </Pressable>
              <Pressable className="flex-1 border border-slate-300 rounded-full py-4 items-center active:opacity-60">
                <Text className="text-slate-900 font-semibold">Vendi ↗</Text>
              </Pressable>
            </View>

            {/* Quantità + Prezzo unitario */}
            <View className="flex-row gap-3 mb-4">
              <View className="flex-1 border border-slate-200 rounded-2xl px-4 py-3">
                <Text className="text-slate-500 text-xs mb-1">Quantità</Text>
                <View className="flex-row items-center justify-between">
                  <Pressable
                    onPress={() => setQty((q) => Math.max(1, q - 1))}
                    hitSlop={10}
                  >
                    <Text className="text-2xl text-slate-400">−</Text>
                  </Pressable>
                  <Text className="text-xl font-bold text-slate-900">
                    {qty} pz
                  </Text>
                  <Pressable onPress={() => setQty((q) => q + 1)} hitSlop={10}>
                    <Text className="text-2xl text-slate-400">+</Text>
                  </Pressable>
                </View>
              </View>
              <View className="flex-1 border border-slate-200 rounded-2xl px-4 py-3">
                <Text className="text-slate-500 text-xs mb-1">
                  Prezzo unitario
                </Text>
                <Text className="text-xl font-bold text-slate-900 mt-1">
                  ${last.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Informazioni */}
            <View className="border border-slate-200 rounded-2xl px-4 py-3 mb-4">
              <Text className="text-slate-500 mb-1">Informazioni</Text>
              <InfoRow
                label="Prezzo di carico"
                value={`$${entry.toFixed(2)}`}
              />
              <InfoRow
                label="Valore di libro"
                value={`$${bookValue.toFixed(2)}`}
              />
              <InfoRow
                label="Totale ordine"
                value={`$${(last * qty).toFixed(2)}`}
              />
            </View>

            {/* Grafico a candele */}
            <View className="border border-slate-200 rounded-2xl p-4">
              <Text className="text-slate-500 mb-2">
                Andamento ({CANDLES} giorni)
              </Text>
              <CandleChart rows={rows} />
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </>
  );
}
