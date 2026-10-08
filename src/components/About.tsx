import { useEffect, useState } from "react";
import { ScrollView } from "react-native";
import { Link } from "expo-router";
import { useApp } from "../lib/context";
import { AboutContent } from "../lib/about";
import { T, Card } from "./ui";
import BrandLogo from "./BrandLogo";
export default function About() {
  const { read } = useApp();
  const [content, setContent] = useState<AboutContent | null>(null),
    [message, setMessage] = useState("Loading our story…");
  useEffect(() => {
    let active = true;
    void read<{ content: AboutContent | null }>("/public/about")
      .then((p) => {
        if (active) {
          setContent(p.content);
          setMessage(
            "Explore doorstep car care, laundry pickup and delivery, cleaning and home services with ANVIRA.",
          );
        }
      })
      .catch(() => {
        if (active)
          setMessage("We couldn’t load our story. Please try again shortly.");
      });
    return () => {
      active = false;
    };
  }, [read]);
  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
      <BrandLogo />
      <T bold size={30}>
        {content?.title || "About ANVIRA Services"}
      </T>
      <T>{content?.intro || message}</T>
      {content &&
        Object.entries(content)
          .filter(([key, value]) => !["title", "intro"].includes(key) && value)
          .map(([key, value]) => (
            <Card key={key}>
              <T bold>
                {
                  (
                    {
                      story: "Our story",
                      mission: "Our mission",
                      values: "Our values",
                      serviceArea: "Where we work",
                    } as Record<string, string>
                  )[key]
                }
              </T>
              <T>{value}</T>
            </Card>
          ))}
      <Link href="/welcome">Back to services</Link>
    </ScrollView>
  );
}
