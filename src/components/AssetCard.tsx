import { Text, View } from "react-native";

export default function AssetCard(asset: string) {
  return (
    <>
      <View className={"flex-1 border-b-2 border-slate-600"}>
        <Text className="text-slate-500">{asset}</Text>
      </View>
    </>
  );
}
