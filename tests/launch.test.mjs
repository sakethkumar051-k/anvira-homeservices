import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { createApplication } from "../server/app.mjs";
import { createSQLiteStore } from "../server/lib/store.mjs";
import { config } from "../server/lib/config.mjs";
import { slotFor } from "../server/lib/domain.mjs";
import { sampleServices } from "../server/lib/sample-catalog.mjs";
import { serviceSchema } from "../server/lib/schemas.mjs";
import { privateDocuments } from "../server/lib/private-documents.mjs";
import {
  exportSnapshot,
  encryptSnapshot,
  decryptSnapshot,
  restoreSnapshot,
} from "../server/lib/backup.mjs";
let application, server, base;
const tokens = {};
async function req(path, role, body, method) {
  const r = await fetch(base + path, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      Authorization: "Bearer " + (tokens[role] || ""),
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: r.status,
    data: await r.json(),
    requestId: r.headers.get("X-Request-ID"),
  };
}
before(async () => {
  const store = await createSQLiteStore(":memory:");
  application = await createApplication({
    store,
    config: config({ APP_MODE: "demo", PAYMENT_MODE: "demo" }),
  });
  server = application.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = "http://127.0.0.1:" + server.address().port + "/api";
  for (const role of ["customer", "professional", "owner", "care"])
    tokens[role] = (await req("/session", "", { role })).data.token;
});
after(async () => {
  await new Promise((r) => server.close(r));
  application.store.close();
});
test("all six core sample services have valid tailored scopes, FAQs, preparation and tasks", () => {
  assert.equal(sampleServices.length, 6);
  for (const service of sampleServices) {
    serviceSchema.parse(service);
    assert.ok(service.excludes.length);
    assert.ok(service.faqs.length);
    assert.ok(service.preparation.length);
    assert.ok(service.checklist.length);
    assert.equal(service.sample, true);
  }
});
test("guest discovery returns the catalog without account or staff information", async () => {
  const result = await req("/catalog");
  assert.equal(result.status, 200);
  assert.equal(result.data.services.length, 6);
  assert.equal(result.data.users, undefined);
  assert.equal(result.data.professionals, undefined);
  assert.ok(result.requestId);
  assert.equal((await req("/state")).status, 401);
});
test("Car Care is a monthly request from discovery through acceptance", async () => {
  const service = (await req("/catalog")).data.services.find(
    (s) => s.id === "car-cleaning",
  );
  assert.equal(service.billingPeriod, "monthly");
  assert.equal(service.bookingMode, "quote");
  assert.equal(service.price, 0);
  assert.deepEqual(service.packages, []);
  assert.equal(
    (await req("/quote", "customer", { serviceId: service.id })).data.code,
    "MONTHLY_PLAN",
  );

  const address = {
    line: "Demo driveway, Shadnagar",
    pin: "509216",
    label: "Home",
  };
  const q = await req("/service-quotes", "customer", {
    serviceId: service.id,
    description: "Preferred cleaning days are Tuesday and Friday.",
    idempotencyKey: "monthly-car-request-1",
    address,
    details: { vehicle: "Hatchback", parking: "Car park, bay 21" },
  });
  assert.equal(q.status, 201);
  assert.equal(q.data.billingPeriod, "monthly");
  const path = "/service-quotes/" + q.data.id;
  const proposal = await req(path + "/propose", "owner", {
    revision: 0,
    items: [{ label: "Monthly Car Care", quantity: 1, unitPrice: 800 }],
    scope: "Fictional monthly fixture with an agreed cleaning schedule.",
    expiresAt: Date.now() + 2 * 86400000,
  });
  assert.equal(proposal.status, 200);
  assert.equal(proposal.data.total, 800);
  assert.equal(proposal.data.duration, undefined);
  assert.equal(
    (await req(path + "/accept", "customer", { revision: 1 })).data.status,
    "accepted",
  );
  const date = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const attempt = await req("/bookings", "customer", {
    serviceId: service.id,
    quoteId: q.data.id,
    address,
    slot: slotFor(date, 9),
    idempotencyKey: "monthly-car-block-direct",
  });
  assert.equal(attempt.data.code, "MONTHLY_PLAN");
  const availability = await req(
    "/availability?serviceId=" +
      service.id +
      "&date=" +
      date +
      "&pin=509216&quoteId=" +
      q.data.id,
    "customer",
  );
  assert.equal(availability.data.code, "MONTHLY_PLAN");
});
let car;
test("a one-time car booking fixture retains question validation and exact snapshots", async () => {
  await application.store.transaction(async (tx) => {
    const service = await tx.get("services", "car-cleaning");
    tx.put("services", { ...service, billingPeriod: "one_time" });
  });
  const input = {
    serviceId: "car-cleaning",
    addons: ["mats"],
    packageId: "inside-out",
    options: { "vehicle-size": "suv", water: "tap" },
    address: { line: "Demo driveway, Shadnagar", pin: "509216" },
    slot: slotFor(
      new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      9,
    ),
    idempotencyKey: "car-complete-details-1",
  };
  assert.equal((await req("/bookings", "customer", input)).status, 400);
  assert.equal(
    (
      await req("/bookings", "customer", {
        ...input,
        details: {
          vehicle: "Tata Nexon",
          parking: "Driveway",
          forged: "ignore",
        },
      })
    ).status,
    400,
  );
  const booked = await req("/bookings", "customer", {
    ...input,
    details: { vehicle: "Tata Nexon", parking: "Driveway beside gate" },
  });
  assert.equal(booked.status, 201);
  car = booked.data;
  assert.equal(car.total, 1248);
  assert.equal(car.duration, 120);
  assert.equal(car.details[0].label, "Car make and model");
  await application.store.transaction(async (tx) => {
    const s = await tx.get("services", "car-cleaning");
    tx.put("services", { ...s, price: 9999, bookingFields: [] });
  });
  const snapshot = (await req("/bookings/" + car.id, "customer")).data;
  assert.equal(snapshot.total, 1248);
  assert.equal(snapshot.details[0].value, "Tata Nexon");
});
test("support response targets escalate once and a staff response clears the waiting state", async () => {
  const ticket = (
    await req("/tickets", "customer", {
      category: "quality",
      message: "Please review my service concern",
      idempotencyKey: "quality-launch-ticket-1",
    })
  ).data;
  assert.ok(ticket.responseDueAt);
  const now = ticket.responseDueAt + 1;
  const first = await application.jobs.maintenance(now);
  assert.equal(first.escalations, 1);
  assert.equal((await application.jobs.maintenance(now)).escalations, 0);
  assert.equal(
    (
      await req("/tickets/" + ticket.id + "/reply", "care", {
        message: "We are reviewing the scope and will follow up.",
        idempotencyKey: "quality-care-reply-1",
      })
    ).status,
    200,
  );
  let saved = await application.store.get("tickets", ticket.id);
  assert.equal(saved.awaitingResponse, false);
  assert.equal(saved.responseDueAt, undefined);
  await req("/tickets/" + ticket.id + "/reply", "customer", {
    message: "Please arrange the next step.",
    idempotencyKey: "quality-customer-reply-2",
  });
  saved = await application.store.get("tickets", ticket.id);
  assert.equal(saved.awaitingResponse, true);
  assert.ok(saved.responseDueAt);
});
test("readiness and telemetry are Owner-only and reflect worker heartbeat", async () => {
  assert.equal((await req("/operations/readiness", "customer")).status, 403);
  assert.equal((await req("/operations/readiness", "care")).status, 403);
  await application.jobs.run();
  const result = (await req("/operations/readiness", "owner")).data;
  assert.equal(
    result.checks.find((x) => x.name === "Background jobs").ready,
    true,
  );
  assert.equal(
    (await req("/operations/telemetry", "professional")).status,
    403,
  );
  assert.equal((await req("/ready")).status, 200);
});
test("portable private documents encrypt content and reject expired or tampered links", async () => {
  const dir = await mkdtemp(join(tmpdir(), "anvira-docs-"));
  try {
    const bucket = privateDocuments({
        directory: dir,
        key: randomBytes(32).toString("base64"),
        publicUrl: "https://example.test",
        production: true,
        persistent: true,
      }),
      file = bucket.file("professionalDocuments/user/../../escape");
    const original = Buffer.from("%PDF-1.4 fictional document");
    await file.save(original, { metadata: { contentType: "application/pdf" } });
    const disk = await readFile(join(dir, (await readdir(dir))[0]));
    assert.equal(disk.includes(original), false);
    const [url] = await file.getSignedUrl({ expires: Date.now() + 60000 });
    const token = new URL(url).searchParams.get("token");
    assert.deepEqual((await bucket.download(token)).buffer, original);
    await assert.rejects(
      bucket.download(token.replace(/.$/, token.endsWith("0") ? "1" : "0")),
    );
    const [expired] = await file.getSignedUrl({ expires: Date.now() - 1 });
    await assert.rejects(
      bucket.download(new URL(expired).searchParams.get("token")),
    );
    await file.delete();
    assert.deepEqual(await readdir(dir), []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("encrypted backup round-trip preserves snapshots and blocks wrong project, key and tampering", async () => {
  const key = randomBytes(32).toString("base64"),
    snapshot = await exportSnapshot(application.store, "demo-launch"),
    encrypted = encryptSnapshot(snapshot, key);
  assert.equal(encrypted.includes(Buffer.from("Tata Nexon")), false);
  assert.throws(() => decryptSnapshot(encrypted, key, "wrong-project"));
  assert.throws(() =>
    decryptSnapshot(
      encrypted,
      randomBytes(32).toString("base64"),
      "demo-launch",
    ),
  );
  const tampered = Buffer.from(encrypted);
  tampered[tampered.length - 1] ^= 1;
  assert.throws(() => decryptSnapshot(tampered, key, "demo-launch"));
  const target = await createSQLiteStore(":memory:");
  try {
    await restoreSnapshot(
      target,
      decryptSnapshot(encrypted, key, "demo-launch"),
    );
    assert.deepEqual(
      await target.get("bookings", car.id),
      await application.store.get("bookings", car.id),
    );
  } finally {
    target.close();
  }
});

test("owner uploads, schedules and edits a banner and public visibility follows its service", async () => {
  const photo = await readFile(
    new URL("fixtures/profile.jpg", import.meta.url),
  );
  const form = {
    title: "Bathroom cleaning",
    subtitle: "Review the included work",
    serviceId: "cleaning",
    order: 1,
    startsOn: "",
    endsOn: "",
    active: true,
    photo: "data:image/jpeg;base64," + photo.toString("base64"),
  };
  assert.equal((await req("/banners", "care", form, "PUT")).status, 403);
  assert.equal(
    (await req("/banners", "owner", { ...form, endsOn: "2026-02-30" }, "PUT"))
      .status,
    400,
  );
  const created = await req("/banners", "owner", form, "PUT");
  assert.equal(created.status, 200);
  const id = created.data.id;
  for (const [path, role] of [
    ["/catalog", ""],
    ["/state", "customer"],
    ["/state", "owner"],
  ]) {
    const list = (await req(path, role)).data.banners;
    assert.equal(list.find((b) => b.id === id)?.title, form.title);
    assert.equal(list.find((b) => b.id === id)?.photo, undefined);
  }
  assert.deepEqual(
    Buffer.from(
      await (await fetch(base + "/banners/" + id + "/photo")).arrayBuffer(),
    ),
    photo,
  );
  const edit = { ...created.data, endsOn: "2000-01-01" };
  assert.equal((await req("/banners", "owner", edit, "PUT")).status, 200);
  assert.equal((await req("/banners", "owner", edit, "PUT")).status, 409);
  assert.equal(
    (await req("/catalog")).data.banners.some((b) => b.id === id),
    false,
  );
  assert.equal((await fetch(base + "/banners/" + id + "/photo")).status, 404);
  const target = (await req("/state", "owner")).data.services.find(
    (s) => s.id === "cleaning",
  );
  assert.equal(
    (
      await req(
        "/services/cleaning",
        "owner",
        { ...target, active: false, status: "paused" },
        "PATCH",
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await req(
        "/banners",
        "owner",
        { ...form, title: "Unavailable destination" },
        "PUT",
      )
    ).status,
    400,
  );
});
