import {
  computeAllMethods,
  loadPrices,
  MethodsResult,
} from "@/src/utils/portfolioMethods";
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
      colors={["#001287", "#002759", "#040A17"]}
      locations={[0, 0.5, 1]}
      style={{ flex: 1 }}
    >
      <SafeAreaView className="flex-1">
        {loading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#22c55e" />
          </View>
        ) : !res ? (
          <View className="flex-1 justify-center items-center">
            <Text className="text-slate-400">Dati insufficienti (servono ≥126 giorni)</Text>
          </View>
        ) : (
          <ScrollView className="flex-1 px-4">
            <Text className="text-white text-2xl font-extrabold mt-4">
              Metodi di allocazione
            </Text>
            <Text className="text-slate-400 mb-4">
              σ mercato: {pct(res.sigmaMkt)}
            </Text>

            {/* Header */}
            <View className="flex-row border-b border-slate-600 pb-2">
              <Text className="flex-1 text-slate-400 font-bold">Ticker</Text>
              <Text className="w-20 text-right text-slate-400 font-bold">InvVol</Text>
              <Text className="w-20 text-right text-slate-400 font-bold">TgtVol</Text>
              <Text className="w-20 text-right text-slate-400 font-bold">Kelly</Text>
            </View>

            {/* Righe per ticker */}
            {res.tickers.map((tk, i) => (
              <View key={tk} className="flex-row py-2 border-b border-slate-800">
                <Text className="flex-1 text-white font-semibold">{tk}</Text>
                <Text className="w-20 text-right text-emerald-400">{pct(res.inverseVol[i])}</Text>
                <Text className="w-20 text-right text-sky-400">{pct(res.targetVol[i])}</Text>
                <Text className="w-20 text-right text-amber-400">{pct(res.kelly[i])}</Text>
              </View>
            ))}

            {/* Totali */}
            <View className="flex-row py-2 border-t-2 border-slate-500 mt-1">
              <Text className="flex-1 text-slate-300 font-bold">TOTALE</Text>
              <Text className="w-20 text-right text-slate-300 font-bold">{pct(sum(res.inverseVol))}</Text>
              <Text className="w-20 text-right text-slate-300 font-bold">{pct(sum(res.targetVol))}</Text>
              <Text className="w-20 text-right text-slate-300 font-bold">{pct(sum(res.kelly))}</Text>
            </View>

            <Text className="text-slate-500 text-xs mt-4 mb-32">
              InvVol somma 100% · TgtVol ≤100% (resto cash) · Kelly ≤100% (resto cash, no leva)
            </Text>
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}
