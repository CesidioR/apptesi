import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={({ state, descriptors, navigation }) => (
        // Contenitore esterno per posizionare la barra staccata dal fondo (Flottante stile Revolut)
        <View className="absolute bottom-6 left-5 right-5 items-center">
          <BlurView
            intensity={80}
            tint="dark"
            className="w-full flex-row justify-around items-center py-3 px-2 rounded-full border border-white/10 overflow-hidden shadow-2xl bg-slate-900/80"
          >
            {state.routes.map((route, index) => {
              const { options } = descriptors[route.key];
              const isFocused = state.index === index;

              const onPress = () => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              };

              // Mappatura delle icone in base alla rotta
              const getIconName = (routeName: string, focused: boolean) => {
                switch (routeName) {
                  case "index":
                    return focused ? "home" : "home-outline";
                  case "analytics":
                    return focused ? "stats-chart" : "stats-chart-outline";
                  case "methods":
                    return "swap-horizontal"; // Icona centrale di scambio estilo Revolut
                  case "cards":
                    return focused ? "card" : "card-outline";
                  case "profile":
                    return focused ? "person" : "person-outline";
                  default:
                    return "ellipse";
                }
              };

              // Se è il pulsante centrale di azione (es. Cambia/Investi/Invia)
              if (route.name === "action") {
                return (
                  <Pressable
                    key={route.key}
                    onPress={onPress}
                    className="w-12 h-12 bg-blue-600 rounded-full justify-center items-center shadow-lg active:opacity-80 -mt-2"
                  >
                    <Ionicons
                      name="swap-horizontal"
                      size={24}
                      color="#ffffff"
                    />
                  </Pressable>
                );
              }

              return (
                <Pressable
                  key={route.key}
                  onPress={onPress}
                  className="items-center justify-center py-1 px-3"
                >
                  <Ionicons
                    name={getIconName(route.name, isFocused) as any}
                    size={22}
                    color={isFocused ? "#38bdf8" : "#94a3b8"}
                  />
                  {options.title && (
                    <Text
                      className={`text-[10px] mt-1 font-medium ${
                        isFocused ? "text-sky-400" : "text-slate-400"
                      }`}
                    >
                      {options.title}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </BlurView>
        </View>
      )}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="assets" options={{ title: "Assets" }} />
      <Tabs.Screen name="methods" options={{ title: "Methods" }} />
    </Tabs>
  );
}
