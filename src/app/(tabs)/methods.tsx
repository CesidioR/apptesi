import {
  computeAllMethods,
  loadPrices,
  MethodsResult,
} from "@/src/utils/portfolioMethods";
import { COLORS } from "@/src/theme";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const pct = (x: number) => (x * 100).toFixed(1) + "%";
const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);

export default function Methods() {
  const [res, setRes] = useState<MethodsResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const rows = await loadPrices();
      setRes(computeAllMethods(rows));
      setLoading(false);
    })();
  }, []);

  return (
    <LinearGradient
      colors={[COLORS.surface, COLORS.background, COLORS.background]}
      locations={[0, 0.5, 1]}
      style={{ flex: 1 }}
    >
      <SafeAreaView className="flex-1">
        {loading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color={COLORS.up} />
          </View>
        ) : !res ? (
          <View className="flex-1 justify-center items-center">
            <Text className="text-muted">Dati insufficienti (servono ≥126 giorni)</Text>
          </View>
        ) : (
          <ScrollView className="flex-1 px-4">
            <Text className="text-content text-2xl font-extrabold mt-4">
              Metodi di allocazione
            </Text>
            <Text className="text-muted mb-4">
              σ mercato: {pct(res.sigmaMkt)}
            </Text>

            {/* Header */}
            <View className="flex-row border-b border-divider pb-2">
              <Text className="flex-1 text-muted font-bold">Ticker</Text>
              <Text className="w-20 text-right text-muted font-bold">InvVol</Text>
              <Text className="w-20 text-right text-muted font-bold">TgtVol</Text>
              <Text className="w-20 text-right text-muted font-bold">Kelly</Text>
            </View>

            {/* Righe per ticker */}
            {res.tickers.map((tk, i) => (
              <View key={tk} className="flex-row py-2 border-b border-divider">
                <Text className="flex-1 text-content font-semibold">{tk}</Text>
                <Text className="w-20 text-right text-up">{pct(res.inverseVol[i])}</Text>
                <Text className="w-20 text-right text-accent">{pct(res.targetVol[i])}</Text>
                <Text className="w-20 text-right text-muted">{pct(res.kelly[i])}</Text>
              </View>
            ))}

            {/* Totali */}
            <View className="flex-row py-2 border-t-2 border-divider mt-1">
              <Text className="flex-1 text-content font-bold">TOTALE</Text>
              <Text className="w-20 text-right text-content font-bold">{pct(sum(res.inverseVol))}</Text>
              <Text className="w-20 text-right text-content font-bold">{pct(sum(res.targetVol))}</Text>
              <Text className="w-20 text-right text-content font-bold">{pct(sum(res.kelly))}</Text>
            </View>

            <Text className="text-muted text-xs mt-4 mb-32">
              InvVol somma 100% · TgtVol ≤100% (resto cash) · Kelly ≤100% (resto cash, no leva)
            </Text>
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}
