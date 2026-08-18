import { useRouter } from "expo-router";
import { Image, Pressable, Text, View } from "react-native";
import Svg, { Polyline } from "react-native-svg";
import { logos } from "../utils/logos";
import { type AssetCardData } from "../utils/portfolioMethods";

const W = 80;
const H = 32;

// Costruisce i punti della sparkline normalizzando i close nel box W×H.
function sparklinePoints(close: number[]): string {
  if (close.length < 2) return "";
  const min = Math.min(...close);
  const max = Math.max(...close);
  const range = max - min || 1; // evita divisione per 0
  return close
    .map((c, i) => {
      const x = (i / (close.length - 1)) * W;
      const y = H - ((c - min) / range) * H; // y invertita: in SVG cresce verso il basso
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export default function AssetCard({ data }: { data: AssetCardData }) {
  const router = useRouter();
  const { ticker, close } = data;
  const last = close.at(-1) ?? 0;
  const first = close[0] ?? last;
  const changePct = first ? (last / first - 1) * 100 : 0;
  const up = changePct >= 0;
  const color = up ? "#22c55e" : "#ef4444";

  return (
    <Pressable
      onPress={() => router.push(`/asset/${ticker}`)}
      className="flex-row items-center rounded-md bg-slate-900/30 justify-between px-4 py-3 border-[0.5px] border-slate-100/30 active:opacity-70">
      <View className="flex-row items-center w-28">
        {logos[ticker] ? (
          <Image
            source={logos[ticker]}
            className="w-8 h-8 rounded-full mr-2"
            resizeMode="contain"
          />
        ) : (
          <View className="w-8 h-8 rounded-full mr-2 bg-slate-700 justify-center items-center">
            <Text className="text-slate-300 text-[10px]">
              {ticker.slice(0, 3)}
            </Text>
          </View>
        )}
        <View>
          <Text className="text-white font-bold">{ticker}</Text>
          <Text className="text-slate-400 text-xs">${last.toFixed(2)}</Text>
        </View>
      </View>

      <Svg width={W} height={H}>
        <Polyline
          points={sparklinePoints(close)}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
        />
      </Svg>

      <Text className="w-16 text-right text-xs font-semibold" style={{ color }}>
        {up ? "+" : ""}
        {changePct.toFixed(1)}%
      </Text>
    </Pressable>
  );
}
