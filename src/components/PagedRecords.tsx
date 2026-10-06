import React, { useEffect, useState } from "react";
import { useIsFocused } from "expo-router";
import { useApp } from "../lib/context";
import { T, Row, Button, c } from "./ui";
type Cursor = [number, string] | [string] | null;
export function usePagedRecords<T>(kind: string, query = "") {
  const focused = useIsFocused();
  const { state, read } = useApp(),
    [rows, setRows] = useState<T[]>([]),
    [history, setHistory] = useState<Cursor[]>([null]),
    [next, setNext] = useState<Cursor>(null),
    [busy, setBusy] = useState(true),
    [error, setError] = useState("");
  const [previousQuery, setPreviousQuery] = useState(query);
  // Reset cursors before loading a different queue; an old cursor can hide its first page.
  if (previousQuery !== query) {
    setPreviousQuery(query);
    setHistory([null]);
    setRows([]);
    setNext(null);
    setError("");
    setBusy(true);
  }
  const cursor = previousQuery === query ? history[history.length - 1] : null;
  useEffect(() => {
    if (!focused) return;
    let current = true;
    void read<{ rows: T[]; nextCursor: Cursor }>(
      (kind === "bookings" ? "/bookings" : "/records/" + kind) +
        "?" +
        [
          query,
          cursor ? "cursor=" + encodeURIComponent(JSON.stringify(cursor)) : "",
        ]
          .filter(Boolean)
          .join("&"),
    )
      .then((page) => {
        if (current) {
          setRows(page.rows);
          setNext(page.nextCursor);
          setError("");
        }
      })
      .catch((e) => {
        if (current) setError((e as Error).message);
      })
      .finally(() => {
        if (current) setBusy(false);
      });
    return () => {
      current = false;
    };
  }, [state, read, kind, cursor, query, focused]);
  return {
    rows,
    busy,
    error,
    page: history.length,
    hasPrevious: history.length > 1,
    hasNext: !!next,
    previous: () => {
      if (!busy && history.length > 1) {
        setBusy(true);
        setHistory((h) => h.slice(0, -1));
      }
    },
    next: () => {
      if (next && !busy) {
        setBusy(true);
        setHistory((h) => [...h, next]);
      }
    },
  };
}
export function PageControls({
  list,
  label,
}: {
  list: ReturnType<typeof usePagedRecords>;
  label: string;
}) {
  return (
    <>
      <Row style={{ flexWrap: "wrap", justifyContent: "space-between" }}>
        <T size={11} color={c.muted}>
          {label} · Page {list.page}
        </T>
        <Row>
          {list.hasPrevious && (
            <Button
              label={"Previous " + label + " page"}
              secondary
              disabled={list.busy}
              onPress={list.previous}
            />
          )}{" "}
          {list.hasNext && (
            <Button
              label={"Next " + label + " page"}
              secondary
              disabled={list.busy}
              onPress={list.next}
            />
          )}
        </Row>
      </Row>
      {list.busy && <T color={c.muted}>Loading records…</T>}
      {!!list.error && <T color={c.red}>{list.error}</T>}
    </>
  );
}
