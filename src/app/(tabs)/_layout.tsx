import { COLORS } from "@/src/theme";
import { Ionicons } from "@expo/vector-icons";
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
          <View className="w-[50%] flex-row justify-around items-center p-2   overflow-hidden ">
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
                    return focused ? "home" : "home";
                  case "assets":
                    return focused ? "stats-chart" : "stats-chart";
                  default:
                    return focused ? "ellipse" : "ellipse-outline";
                }
              };

              // Se è il pulsante centrale di azione (es. Cambia/Investi/Invia)
              if (route.name === "action") {
                return (
                  <Pressable
                    key={route.key}
                    onPress={onPress}
                    className="w-12 h-12 bg-accent rounded-full justify-center items-center shadow-lg active:opacity-80 -mt-2"
                  >
                    <Ionicons
                      name="swap-horizontal"
                      size={24}
                      color={COLORS.background}
                    />
                  </Pressable>
                );
              }

              const iconName = getIconName(route.name, isFocused) as any;

              // Tab ATTIVA
              if (isFocused) {
                return (
                  <Pressable
                    key={route.key}
                    onPress={onPress}
                    className="flex-row h-14 items-center bg-accent rounded-full px-4  py-2.5 active:opacity-90"
                  >
                    <Ionicons name={iconName} size={20} color="#FFFFFF" />
                    {options.title && (
                      <Text className="ml-2 font-bold text-white">
                        {options.title}
                      </Text>
                    )}
                  </Pressable>
                );
              }

              // Tab INATTIVA: solo icona
              return (
                <Pressable
                  key={route.key}
                  onPress={onPress}
                  className="w-14 bg-white rounded-full p-2 h-14 items-center justify-center active:opacity-60"
                >
                  <Ionicons name={iconName} size={22} color="#000000" />
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="assets" options={{ title: "Assets" }} />
    </Tabs>
  );
}
