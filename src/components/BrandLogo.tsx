import { Image, View } from "react-native";
export default function BrandLogo({ width = 150 }: { width?: number }) {
  return (
    <View
      style={{
        width,
        height: width * 0.63,
        borderRadius: 8,
        overflow: "hidden",
        backgroundColor: "#FFFFFF",
      }}
    >
      <Image
        source={require("../../assets/anvira-logo.png")}
        accessibilityLabel="ANVIRA Services"
        resizeMode="cover"
        style={{ width, height: width * 0.63 }}
      />
    </View>
  );
}
