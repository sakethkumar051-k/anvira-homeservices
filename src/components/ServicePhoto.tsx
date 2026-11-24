import { Image, ImageStyle, StyleProp, View } from "react-native";
import type { Service } from "../lib/model";
import {
  MainServiceCategory,
  serviceCategoryKey,
} from "../lib/service-presentation";
import { Icon, c } from "./ui";

export const servicePhotos = {
  home: require("../../assets/services/cleaning.jpg"),
  car: require("../../assets/services/car.jpg"),
  ac: require("../../assets/services/ac.jpg"),
  ro: require("../../assets/services/ro.jpg"),
  bathroom: require("../../assets/services/bathroom.jpg"),
  kitchen: require("../../assets/services/kitchen.jpg"),
  plumbing: require("../../assets/services/plumbing.jpg"),
  electrical: require("../../assets/services/electrical.jpg"),
  sofa: require("../../assets/services/sofa.jpg"),
  laundry: require("../../assets/services/laundry.jpg"),
  commercial: require("../../assets/services/commercial.jpg"),
  beauty: require("../../assets/services/beauty.jpg"),
};

export function ServicePhoto({
  service,
  category,
  packageName,
  style,
}: {
  service?: Pick<Service, "id" | "name" | "category" | "photoKey">;
  category?: MainServiceCategory;
  packageName?: string;
  style?: StyleProp<ImageStyle>;
}) {
  const text =
    `${packageName || ""} ${service?.id || ""} ${service?.name || ""}`.toLowerCase();
  const key =
    service?.photoKey ||
    category ||
    (/bathroom/.test(text)
      ? "bathroom"
      : /kitchen/.test(text)
        ? "kitchen"
        : /sofa/.test(text)
          ? "sofa"
          : /laundry/.test(text)
            ? "laundry"
            : /commercial/.test(text)
              ? "commercial"
              : /beauty|makeup/.test(text)
                ? "beauty"
                : service
                  ? serviceCategoryKey(service)
                  : "other");
  const source = servicePhotos[key as keyof typeof servicePhotos];
  if (!source)
    return (
      <View
        style={[
          {
            backgroundColor: c.mint,
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: 150,
          },
          style,
        ]}
      >
        <Icon name={key === "ro" ? "water" : "tool"} size={42} />
      </View>
    );
  return (
    <Image
      source={source}
      accessible={false}
      resizeMode="cover"
      style={[{ width: "100%", height: 150, backgroundColor: c.mint }, style]}
    />
  );
}
