import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { useIsFocused } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { useApp } from "../lib/context";
import { Professional } from "../lib/model";
import { T, Card, Button, Row, Input, c } from "./ui";
export function ProfessionalPhoto({
  professional: p,
  size = 56,
}: {
  professional: Professional;
  size?: number;
}) {
  const { read } = useApp(),
    focused = useIsFocused(),
    [photo, setPhoto] = useState("");
  useEffect(() => {
    let cancelled = false;
    if (focused && p.photoUpdatedAt)
      void read<{ dataUri: string }>("/professional/" + p.id + "/photo")
        .then((v) => {
          if (!cancelled) setPhoto(v.dataUri);
        })
        .catch(() => {
          if (!cancelled) setPhoto("");
        });
    return () => {
      cancelled = true;
    };
  }, [p.id, p.photoUpdatedAt, read, focused]);
  const style = { width: size, height: size, borderRadius: size / 2 };
  return p.photoUpdatedAt && photo ? (
    <Image
      accessibilityLabel={p.name + " profile photo"}
      source={{ uri: photo }}
      style={style}
    />
  ) : (
    <View
      style={{
        ...style,
        backgroundColor: c.mint,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <T bold size={size / 3} color={c.green}>
        {p.name
          .split(" ")
          .map((x) => x[0])
          .slice(0, 2)
          .join("")}
      </T>
    </View>
  );
}
export function ProfessionalProfileEditor({
  professional: p,
}: {
  professional: Professional;
}) {
  const { request } = useApp(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [bio, setBio] = useState(p.bio || ""),
    [languages, setLanguages] = useState((p.languages || []).join(", "));
  async function photo() {
    setBusy(true);
    setMessage("");
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled) return;
      const asset = result.assets[0],
        side = Math.min(asset.width, asset.height);
      const context = ImageManipulator.manipulate(asset.uri);
      context
        .crop({
          originX: Math.floor((asset.width - side) / 2),
          originY: Math.floor((asset.height - side) / 2),
          width: side,
          height: side,
        })
        .resize({ width: 256, height: 256 });
      const image = await context.renderAsync();
      let saved = await image.saveAsync({
        format: SaveFormat.JPEG,
        compress: 0.65,
        base64: true,
      });
      if ((saved.base64?.length || 0) > 43000)
        saved = await image.saveAsync({
          format: SaveFormat.JPEG,
          compress: 0.35,
          base64: true,
        });
      if (!saved.base64 || saved.base64.length > 43000)
        throw new Error(
          "Choose a simpler photo. The compressed profile image must be under 32 KB.",
        );
      await request("/professional/photo", {
        dataUri: "data:image/jpeg;base64," + saved.base64,
      });
      setMessage(
        "Profile photo saved. Customers can see it on your assigned bookings.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function act(path: string, body?: unknown, method?: string) {
    setBusy(true);
    setMessage("");
    try {
      await request(path, body, method);
      setMessage("Professional profile saved.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <Row>
        <ProfessionalPhoto professional={p} size={80} />
        <View style={{ flex: 1 }}>
          <T bold size={20}>
            Your public profile
          </T>
          <T color={c.muted}>Help customers recognise the person arriving.</T>
        </View>
      </Row>
      <Button
        label={p.photoUpdatedAt ? "Change profile photo" : "Add profile photo"}
        loading={busy}
        onPress={() => void photo()}
      />
      {!!p.photoUpdatedAt && (
        <Button
          label="Remove profile photo"
          secondary
          disabled={busy}
          onPress={() => void act("/professional/photo", undefined, "DELETE")}
        />
      )}
      <Input
        label="About your work"
        value={bio}
        multiline
        maxLength={500}
        onChangeText={setBio}
      />
      <Input
        label="Languages spoken (comma separated)"
        value={languages}
        onChangeText={setLanguages}
      />
      <Button
        label="Save public profile"
        secondary
        loading={busy}
        onPress={() =>
          void act(
            "/professional/profile",
            {
              bio,
              languages: languages
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
            },
            "PATCH",
          )
        }
      />
      {!!message && <T accessibilityRole="alert">{message}</T>}
    </Card>
  );
}
