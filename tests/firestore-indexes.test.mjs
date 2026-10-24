import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { recentOrder } from "../server/lib/reporting.mjs";

// The local emulator does not enforce composite indexes. Keep both role-specific
// production quote queries deployable, including the unfiltered staff inbox.
for (const [role, filters] of [
  ["staff", []],
  ["customer", [{ fieldPath: "customerId", order: "ASCENDING" }]],
]) {
  test(`Firestore deployment indexes cover the ${role} quote inbox`, async () => {
    const { indexes } = JSON.parse(
      await readFile("firestore.indexes.json", "utf8"),
    );
    const fields = [
      ...filters,
      ...recentOrder.map(([fieldPath, direction]) => ({
        fieldPath,
        order: direction === "desc" ? "DESCENDING" : "ASCENDING",
      })),
    ];
    assert.ok(
      indexes.some(
        (index) =>
          index.collectionGroup === "serviceQuotes" &&
          index.queryScope === "COLLECTION" &&
          JSON.stringify(index.fields) === JSON.stringify(fields),
      ),
      `Missing serviceQuotes index for the ${role} quote inbox`,
    );
  });
}
