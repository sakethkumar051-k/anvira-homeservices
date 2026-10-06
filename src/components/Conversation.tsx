import { loadDraft, saveDraft, removeDraft } from "../lib/drafts";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { useIsFocused } from "expo-router";
import { useApp } from "../lib/context";
import { Booking, dateLabel } from "../lib/model";
import { T, Card, Input, Button, c, Row } from "./ui";
type Message = {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  createdAt: number;
};
type Page = { rows: Message[]; nextCursor: [number, string] | null };
export function Conversation({ booking }: { booking: Booking }) {
  const focused = useIsFocused();
  const { state, read, request } = useApp(),
    [open, setOpen] = useState(false),
    [messages, setMessages] = useState<Message[]>([]),
    [text, setText] = useState(""),
    [cursor, setCursor] = useState<Page["nextCursor"]>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const retry = useRef({ text: "", key: "" });
  const [draftReady, setDraftReady] = useState(false);
  const userId = state?.user.id;
  useEffect(() => {
    let current = true;
    if (!userId) return;
    void loadDraft<{ text: string; key: string }>(
      userId,
      "message-" + booking.id,
    ).then((d) => {
      if (current) {
        if (d) {
          setText(d.text);
          retry.current = { text: d.text, key: d.key };
        }
        setDraftReady(true);
      }
    });
    return () => {
      current = false;
    };
  }, [userId, booking.id]);
  useEffect(() => {
    if (!draftReady || !userId) return;
    const timeout = setTimeout(() => {
      if (text && retry.current.text !== text)
        retry.current = {
          text,
          key:
            "message-" + Date.now() + "-" + Math.random().toString(36).slice(2),
        };
      void (
        text
          ? saveDraft(userId, "message-" + booking.id, {
              text,
              key: retry.current.key,
            })
          : removeDraft(userId, "message-" + booking.id)
      ).catch(() => {});
    }, 600);
    return () => clearTimeout(timeout);
  }, [draftReady, userId, booking.id, text]);
  const load = useCallback(async () => {
    try {
      const page = await read<Page>("/bookings/" + booking.id + "/messages");
      setMessages(page.rows);
      setCursor(page.nextCursor);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [booking.id, read]);
  useEffect(() => {
    if (!open || !focused) return;
    let current = true;
    void read<Page>("/bookings/" + booking.id + "/messages")
      .then((page) => {
        if (current) {
          setMessages(page.rows);
          setCursor(page.nextCursor);
          setError("");
        }
      })
      .catch((e) => {
        if (current) setError((e as Error).message);
      });
    return () => {
      current = false;
    };
  }, [open, read, booking.id, state, focused]);
  useEffect(() => {
    if (!open || !focused) return;
    let loading = false;
    const timer = setInterval(() => {
      if (
        loading ||
        AppState.currentState !== "active" ||
        (Platform.OS === "web" && document.hidden)
      )
        return;
      loading = true;
      void load().finally(() => {
        loading = false;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [open, focused, load]);
  const [openedAt] = useState(() => Date.now());
  async function older() {
    if (!cursor) return;
    setBusy(true);
    try {
      const page = await read<Page>(
        "/bookings/" +
          booking.id +
          "/messages?cursor=" +
          encodeURIComponent(JSON.stringify(cursor)),
      );
      setMessages((current) => [
        ...new Map([...current, ...page.rows].map((m) => [m.id, m])).values(),
      ]);
      setCursor(page.nextCursor);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    if (retry.current.text !== text)
      retry.current = {
        text,
        key:
          "message-" + Date.now() + "-" + Math.random().toString(36).slice(2),
      };
    try {
      await request("/bookings/" + booking.id + "/messages", {
        message: text,
        idempotencyKey: retry.current.key,
      });
      if (userId)
        await removeDraft(userId, "message-" + booking.id).catch(() => {});
      setText("");
      retry.current = { text: "", key: "" };
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!booking.professionalId) return null;
  const writable =
    ["assigned", "confirmed", "in_progress", "completed"].includes(
      booking.status,
    ) &&
    (!booking.completedAt || booking.completedAt > openedAt - 7 * 86400000);
  return (
    <Card>
      <T bold size={20}>
        Booking conversation
      </T>
      <T color={c.muted} size={12}>
        Coordinate this service with your customer or professional. ANVIRA staff
        can access this conversation for support. Messages expire after 30 days.
      </T>
      <Button
        label={open ? "Hide conversation" : "Open conversation"}
        secondary
        onPress={() => setOpen(!open)}
      />
      {open && (
        <>
          <T size={12} color={c.muted}>
            New messages are checked every 5 seconds while this conversation is
            open. An unsent draft is kept on this device.
          </T>
          <Button
            label="Refresh conversation"
            secondary
            disabled={busy}
            onPress={() => void load()}
          />
          {cursor && (
            <Button
              label="Load earlier messages"
              secondary
              loading={busy}
              onPress={() => void older()}
            />
          )}
          {[...messages]
            .sort(
              (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id),
            )
            .map((m) => (
              <Card
                key={m.id}
                style={{
                  backgroundColor:
                    m.senderId === state?.user.id ? c.mint : c.ivory,
                }}
              >
                <Row
                  style={{ justifyContent: "space-between", flexWrap: "wrap" }}
                >
                  <T bold>{m.senderName}</T>
                  <T size={10} color={c.muted}>
                    {dateLabel(m.createdAt)}
                  </T>
                </Row>
                <T selectable>{m.message}</T>
              </Card>
            ))}
          {!messages.length && <T color={c.muted}>No messages yet.</T>}
          {writable ? (
            <>
              <Input
                label="Booking message"
                value={text}
                onChangeText={setText}
                multiline
                maxLength={1000}
              />
              <Button
                label="Send booking message"
                loading={busy}
                disabled={!text.trim()}
                onPress={() => void send()}
              />
            </>
          ) : (
            <T color={c.muted}>
              This conversation is read-only. Contact support for further help.
            </T>
          )}
          {!!error && <T color={c.red}>{error}</T>}
        </>
      )}
    </Card>
  );
}
