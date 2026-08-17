import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import EquityChart from "../../components/EquityChart";

export default function HomeScreen() {
  const [agentWeights, setAgentWeights] = useState<number[] | null>(null);

  // Inferenza dell'agente UNA sola volta (async va nell'effect, non nel componente).
  /* useEffect(() => {
    (async () => {
      try {
        const inputs = computeFeature(await loadPrices(), await loadMarket());
        const weights = await runAgent(inputs);
        console.log("pesi agente:", weights);
        setAgentWeights(weights);
      } catch (e) {
        console.error("Errore inferenza agente:", e);
      }
    })();
  }, []); */

  return (
    <LinearGradient
      colors={["#001287", "#002759", "#040A17"]}
      locations={[0, 0.5, 1]}
      style={{ flex: 1 }}
    >
      <SafeAreaView className="flex-1 justify-center">
        <Text className="font-extrabold text-white text-2xl px-4 mb-2">
          Backtest strategie
        </Text>
        <EquityChart />
        {agentWeights && (
          <Text className="text-slate-400 text-xs px-4 mt-3">
            Agente ONNX:{" "}
            {agentWeights.map((w) => (w * 100).toFixed(1) + "%").join(" · ")}
          </Text>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}
