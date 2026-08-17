import React from "react";
import { View } from "react-native";
import { Area, CartesianChart, Line } from "victory-native";

// Dati del portafoglio (x deve essere un numero o indice per CartesianChart)
const DATA = [
  { day: 1, label: "Sep 8", value: 720 },
  { day: 2, label: "Sep 15", value: 880 },
  { day: 3, label: "Sep 22", value: 810 },
  { day: 4, label: "Sep 29", value: 990 },
  { day: 5, label: "Oct 2", value: 940 },
  { day: 6, label: "Oct 8", value: 1180 },
];

export default function PortfolioChart() {
  return (
    <View className="w-full h-64 p-4">
      <CartesianChart
        data={DATA}
        xKey="day"
        yKeys={["value"]}
        axisOptions={{
          tickCount: 5,
          lineColor: "#334155",
          labelColor: "#94a3b8",
          formatYLabel: (value) => `$${value}`,
          formatXLabel: (value) => {
            const item = DATA.find((d) => d.day === value);
            return item ? item.label : "";
          },
        }}
      >
        {({ points, chartBounds }) => (
          <>
            {/* Area sfumata sotto il grafico */}
            <Area
              points={points.value}
              y0={chartBounds.bottom}
              color="#22c55e"
              opacity={0.2}
              animate={{ type: "timing", duration: 300 }}
            />
            {/* Linea principale verde del grafico */}
            <Line
              points={points.value}
              color="#22c55e"
              strokeWidth={3}
              curveType="natural" // Rende la linea morbida e curva stile Revolut
              animate={{ type: "timing", duration: 300 }}
            />
          </>
        )}
      </CartesianChart>
    </View>
  );
}
