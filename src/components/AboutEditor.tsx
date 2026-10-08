import { useEffect, useState } from "react";
import { Link } from "expo-router";
import { useApp } from "../lib/context";
import { AboutPage, blankAbout } from "../lib/about";
import { Card, T, Input, Button, Badge } from "./ui";

export default function AboutEditor() {
  const { read, request, busy } = useApp();
  const [page, setPage] = useState<AboutPage | null>(null);
  const [form, setForm] = useState(blankAbout);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  const load = () => {
    setError("");
    void read<AboutPage>("/about")
      .then((p) => {
        setPage(p);
        setForm(p.draft);
      })
      .catch((e) => setError(e.message));
  };
  useEffect(() => {
    let active = true;
    void read<AboutPage>("/about")
      .then((p) => {
        if (active) {
          setPage(p);
          setForm(p.draft);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [read]);
  async function save(action: "save" | "publish" | "unpublish") {
    if (!page) return;
    setError("");
    setMessage("");
    try {
      const result = await request<AboutPage>(
        "/about",
        { action, revision: page.revision, content: form },
        "PUT",
      );
      setPage(result);
      setForm(result.draft);
      setMessage(
        action === "save"
          ? "Draft saved. The live page is unchanged."
          : action === "publish"
            ? "About Us published on the website."
            : "About Us unpublished. Your draft is kept.",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Card>
      <T bold size={22}>
        About Us website page
      </T>
      <T>
        Tell customers your real company story. Save privately, preview, then
        publish when ready. Only the Owner can edit or publish this page.
      </T>
      <Badge label={page?.published ? "Published" : "Not published"} />
      {page?.publishedAt && (
        <T>Last published: {new Date(page.publishedAt).toLocaleString()}</T>
      )}
      {!page ? (
        <>
          <T>{error || "Loading editor…"}</T>
          <Button label="Reload About Us editor" onPress={load} />
        </>
      ) : (
        <>
          {(
            [
              ["title", "Page title", 120],
              ["intro", "Short introduction", 600],
              ["story", "Our company story", 6000],
              ["mission", "Our mission (optional)", 1200],
              ["values", "Our values (optional)", 1200],
              ["serviceArea", "Service areas (optional)", 300],
            ] as const
          ).map(([key, label, max]) => (
            <Input
              key={key}
              label={label}
              value={form[key]}
              maxLength={max}
              multiline={key !== "title"}
              onChangeText={(value) => {
                setForm((f) => ({ ...f, [key]: value }));
                setMessage("");
              }}
            />
          ))}
          <T>
            Plain text only. Title, introduction and story are required to
            publish.
          </T>
          <Button
            label={preview ? "Hide draft preview" : "Preview draft"}
            secondary
            onPress={() => setPreview(!preview)}
          />
          {preview && (
            <Card>
              <T bold size={24}>
                {form.title || "Page title"}
              </T>
              {Object.entries(form)
                .filter(([k, v]) => k !== "title" && v)
                .map(([k, v]) => (
                  <T key={k}>{v}</T>
                ))}
            </Card>
          )}
          <Button
            label="Save About Us draft"
            loading={busy}
            onPress={() => void save("save")}
          />
          <Button
            label="Publish About Us"
            loading={busy}
            disabled={
              form.title.trim().length < 2 ||
              form.intro.trim().length < 20 ||
              form.story.trim().length < 40
            }
            onPress={() => void save("publish")}
          />
          {page.published && (
            <Button
              label="Unpublish About Us"
              secondary
              loading={busy}
              onPress={() => void save("unpublish")}
            />
          )}
          <Link href="/about">View public About Us page →</Link>
          {!!message && <T accessibilityRole="alert">{message}</T>}
          {!!error && (
            <>
              <T accessibilityRole="alert">{error}</T>
              <Button label="Reload About Us editor" secondary onPress={load} />
              <T>Reload replaces unsaved changes with the saved draft.</T>
            </>
          )}
        </>
      )}
    </Card>
  );
}
