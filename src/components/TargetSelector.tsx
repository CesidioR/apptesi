// Selettore dei target di volatilita' (per portafoglio): modello DRL (15/20/25%,
// un modello ONNX per ciascuno) e metodo Target Volatility. Vale per l'allocazione
// live e per il backtest. Resi come dropdown in stile "select".
import { usePortfolio } from "../context/PortfolioContext";
import { type AgentTarget } from "../utils/agentConfig";
import Dropdown, { type Option } from "./Dropdown";
import { Text, View } from "react-native";

const MODEL_OPTIONS: Option<AgentTarget>[] = [
  { label: "15%", value: 15 },
  { label: "20%", value: 20 },
  { label: "25%", value: 25 },
];

const METHOD_OPTIONS: Option<number>[] = [
  { label: "10%", value: 0.1 },
  { label: "15%", value: 0.15 },
  { label: "20%", value: 0.2 },
  { label: "25%", value: 0.25 },
];

export default function TargetSelector() {
  const { modelTarget, setModelTarget, methodTargetVol, setMethodTargetVol } =
    usePortfolio();

  return (
    <View className="mt-4">
      <Text className="text-content font-semibold mb-2">
        Target di volatilità
      </Text>

      <View className="flex-row gap-3">
        <View className="flex-1">
          <Dropdown<AgentTarget>
            label="Modello DRL"
            value={modelTarget}
            options={MODEL_OPTIONS}
            onChange={setModelTarget}
          />
        </View>
        <View className="flex-1">
          <Dropdown<number>
            label="Volatility Targeting"
            value={methodTargetVol}
            options={METHOD_OPTIONS}
            onChange={setMethodTargetVol}
          />
        </View>
      </View>

      <Text className="text-muted text-xs mt-2">
        Vale per l'agente e per il metodo Volatility Targeting, sia
        nell'allocazione sia nel backtest.
      </Text>
    </View>
  );
}
