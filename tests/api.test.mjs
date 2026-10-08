import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
let processApi, temp;
const base = "http://127.0.0.1:4109/api";
async function req(path, token, body, method) {
  const r = await fetch(base + path, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json() };
}
const tokens = {};
let created;
const slot = () =>
  Date.parse(
    new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10) +
      "T06:30:00Z",
  );
const payload = (key, serviceId = "cleaning", time = slot()) => ({
  serviceId,
  slot: time,
  address: { line: "12 Garden Street, Shadnagar", pin: "509216" },
  addons: [],
  idempotencyKey: key,
});
before(async () => {
  temp = await mkdtemp(join(tmpdir(), "anvira-test-"));
  processApi = spawn(process.execPath, ["server/index.mjs"], {
    env: {
      ...process.env,
      NODE_ENV: "test",
      APP_MODE: "demo",
      PAYMENT_MODE: "demo",
      PORT: "4109",
      DB_PATH: join(temp, "test.sqlite"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    processApi.stdout.on("data", (d) => {
      if (d.toString().includes("listening")) resolve();
    });
    processApi.on("error", reject);
    processApi.on("exit", (c) => reject(new Error("API exited " + c)));
  });
  for (const role of ["customer", "professional", "owner", "care"])
    tokens[role] = (await req("/session", "", { role })).data.token;
});
after(async () => {
  processApi.kill();
  await new Promise((r) => processApi.once("exit", r));
  await rm(temp, { recursive: true, force: true });
});
test("unauthenticated access is rejected", async () =>
  assert.equal((await req("/state", "invalid")).status, 401));
test("server validates sample service, slot and coverage", async () => {
  assert.equal(
    (
      await req(
        "/bookings",
        tokens.customer,
        payload("missing-service", "missing"),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await req("/bookings", tokens.customer, {
        ...payload("bad-pin-000"),
        address: { line: "House address", pin: "500001" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await req(
        "/bookings",
        tokens.customer,
        payload("past-slot-000", "cleaning", Date.now() - 1),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await req("/bookings", tokens.customer, {
        ...payload("bad-addon-000"),
        addons: ["fake"],
      })
    ).status,
    400,
  );
});
test("booking request retries do not create duplicates", async () => {
  const results = await Promise.all([
    req("/bookings", tokens.customer, payload("retry-request-001")),
    req("/bookings", tokens.customer, payload("retry-request-001")),
  ]);
  assert.equal(results[0].status, 201);
  assert.equal(results[0].data.id, results[1].data.id);
  created = results[0].data;
  assert.equal(created.total, 1499);
});
test("overlapping unpaid reservations respect actual professional capacity", async () => {
  const results = await Promise.all([
    req("/bookings", tokens.customer, payload("parallel-request-002")),
    req("/bookings", tokens.customer, payload("parallel-request-003")),
  ]);
  assert.deepEqual(results.map((x) => x.status).sort(), [201, 409]);
});
test("price snapshots remain unchanged when owner changes catalog", async () => {
  assert.equal(
    (await req("/services/cleaning", tokens.care, { price: 899 }, "PATCH"))
      .status,
    403,
  );
  assert.equal(
    (await req("/services/cleaning", tokens.owner, { price: 1899 }, "PATCH"))
      .status,
    200,
  );
  const state = (await req("/state", tokens.customer)).data;
  assert.equal(state.bookings.find((b) => b.id === created.id).total, 1499);
});
test("paid booking is assigned and payment retry is idempotent", async () => {
  const b = (
    await req("/bookings/" + created.id + "/action", tokens.customer, {
      action: "pay",
    })
  ).data;
  assert.equal(b.status, "assigned");
  assert.equal(b.professionalId, "pro-1");
  assert.equal(
    (
      await req("/bookings/" + created.id + "/action", tokens.customer, {
        action: "pay",
      })
    ).data.total,
    1499,
  );
});
test("customer cannot start or complete professional jobs", async () =>
  assert.equal(
    (
      await req("/bookings/" + created.id + "/action", tokens.customer, {
        action: "start",
      })
    ).status,
    403,
  ));
test("professional sees assigned jobs only and job state transitions are enforced", async () => {
  const state = (await req("/state", tokens.professional)).data;
  assert.equal(state.bookings.length, 1);
  assert.equal(
    (
      await req("/bookings/" + created.id + "/action", tokens.professional, {
        action: "complete",
        checklist: Array(3 + (created.serviceChecklist?.length || 0)).fill(
          true,
        ),
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await req("/bookings/" + created.id + "/action", tokens.professional, {
        action: "accept",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await req("/bookings/" + created.id + "/action", tokens.professional, {
        action: "start",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await req("/bookings/" + created.id + "/action", tokens.professional, {
        action: "complete",
        checklist: [true, false, true],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await req("/bookings/" + created.id + "/action", tokens.professional, {
        action: "complete",
        checklist: Array(3 + (created.serviceChecklist?.length || 0)).fill(
          true,
        ),
      })
    ).status,
    200,
  );
});
test("only one review is allowed after completed service", async () => {
  assert.equal(
    (
      await req("/bookings/" + created.id + "/action", tokens.customer, {
        action: "review",
        rating: 6,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await req("/bookings/" + created.id + "/action", tokens.customer, {
        action: "review",
        rating: 2,
        text: "Please follow up on the cleaning quality",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await req("/bookings/" + created.id + "/action", tokens.customer, {
        action: "review",
        rating: 5,
      })
    ).status,
    409,
  );
});
test("a low rating creates exactly one booking-linked quality follow-up", async () => {
  const state = (await req("/state", tokens.owner)).data;
  assert.equal(
    state.tickets.filter((t) => t.bookingId === created.id).length,
    1,
  );
  const t = state.tickets.find((t) => t.bookingId === created.id);
  assert.equal(t.priority, "high");
  assert.equal(t.category, "quality");
  assert.ok(
    state.audit.some(
      (a) => a.action === "quality_followup_created" && a.target === t.id,
    ),
  );
});
test("rescheduling rejects conflicts without changing original slot", async () => {
  const b = (
    await req(
      "/bookings",
      tokens.customer,
      payload("reschedule-booking-01", "plumbing", slot() + 86400000),
    )
  ).data;
  await req("/bookings/" + b.id + "/action", tokens.customer, {
    action: "pay",
  });
  const conflict = (
    await req(
      "/bookings",
      tokens.customer,
      payload("reschedule-conflict-01", "plumbing", slot()),
    )
  ).data;
  await req("/bookings/" + conflict.id + "/action", tokens.customer, {
    action: "pay",
  });
  const denied = await req("/bookings/" + b.id + "/action", tokens.customer, {
    action: "reschedule",
    slot: slot(),
  });
  assert.equal(denied.status, 409);
  const state = (await req("/state", tokens.customer)).data;
  assert.equal(state.bookings.find((x) => x.id === b.id).slot, b.slot);
});
test("refund approval is restricted to owner and cannot be duplicated", async () => {
  const b = (
    await req(
      "/bookings",
      tokens.customer,
      payload("refund-booking-000", "plumbing", slot() + 2 * 86400000),
    )
  ).data;
  await req("/bookings/" + b.id + "/action", tokens.customer, {
    action: "pay",
  });
  assert.equal(
    (
      await req("/bookings/" + b.id + "/action", tokens.customer, {
        action: "cancel",
      })
    ).data.refund,
    "requested",
  );
  assert.equal(
    (
      await req("/bookings/" + b.id + "/action", tokens.care, {
        action: "refund",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await req("/bookings/" + b.id + "/action", tokens.owner, {
        action: "refund",
      })
    ).data.payment,
    "refunded",
  );
  assert.equal(
    (
      await req("/bookings/" + b.id + "/action", tokens.owner, {
        action: "refund",
      })
    ).status,
    409,
  );
});
test("customer support requests reach care and resolution is audited", async () => {
  const t = (
    await req("/tickets", tokens.customer, {
      message: "Please help with my service booking.",
    })
  ).data;
  assert.equal(
    (await req("/tickets/" + t.id + "/resolve", tokens.customer, {})).status,
    403,
  );
  assert.equal(
    (await req("/tickets/" + t.id + "/resolve", tokens.care, {})).data.status,
    "resolved",
  );
  const state = (await req("/state", tokens.owner)).data;
  assert.ok(
    state.audit.some((a) => a.action === "resolve" && a.target === t.id),
  );
});
test("professional approval restricted to owner", async () => {
  assert.equal(
    (await req("/professionals/pro-3/approve", tokens.care, {})).status,
    403,
  );
  assert.equal(
    (await req("/professionals/pro-3/approve", tokens.owner, {})).data.approved,
    true,
  );
});

test("professional availability affects new assignment without releasing existing jobs", async () => {
  assert.equal(
    (await req("/availability", tokens.customer, { available: false }, "PATCH"))
      .status,
    403,
  );
  assert.equal(
    (
      await req(
        "/availability",
        tokens.professional,
        { available: false },
        "PATCH",
      )
    ).status,
    200,
  );
  const b = (
    await req(
      "/bookings",
      tokens.customer,
      payload("availability-test-01", "cleaning", slot() + 5 * 86400000),
    )
  ).data;
  const paid = (
    await req("/bookings/" + b.id + "/action", tokens.customer, {
      action: "pay",
    })
  ).data;
  assert.equal(paid.professionalId, "pro-2");
  assert.equal(
    (
      await req("/bookings/" + b.id + "/action", tokens.professional, {
        action: "accept",
      })
    ).status,
    403,
  );
  await req("/availability", tokens.professional, { available: true }, "PATCH");
});
test("declined job is reassigned to a different eligible professional", async () => {
  const b = (
    await req(
      "/bookings",
      tokens.customer,
      payload("decline-test-0001", "cleaning", slot() + 6 * 86400000),
    )
  ).data;
  await req("/bookings/" + b.id + "/action", tokens.customer, {
    action: "pay",
  });
  const result = await req(
    "/bookings/" + b.id + "/action",
    tokens.professional,
    { action: "decline" },
  );
  assert.equal(result.status, 200);
  assert.equal(result.data.professionalId, "pro-2");
  assert.equal(
    (
      await req("/bookings/" + b.id + "/action", tokens.professional, {
        action: "accept",
      })
    ).status,
    403,
  );
});

test("booking-linked support enforces ownership, two-way replies and reopening", async () => {
  const t = (
    await req("/tickets", tokens.customer, {
      message: "Please help with the service quality.",
      bookingId: created.id,
      category: "quality",
    })
  ).data;
  assert.equal(t.bookingId, created.id);
  assert.equal(
    (
      await req("/tickets/" + t.id + "/reply", tokens.professional, {
        message: "Unauthorized reply",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await req("/tickets/" + t.id + "/reply", tokens.care, {
        message: "We will follow up with you.",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await req("/tickets/" + t.id + "/reply", tokens.customer, {
        message: "Thank you. Please call tomorrow.",
      })
    ).status,
    200,
  );
  await req("/tickets/" + t.id + "/resolve", tokens.owner, {
    resolution: "We have contacted the professional and agreed on a follow-up.",
  });
  await req("/tickets/" + t.id + "/resolve", tokens.owner, {
    resolution: "Duplicate resolution must not create a second message.",
  });
  assert.equal(
    (
      await req("/tickets/" + t.id + "/reply", tokens.care, {
        message: "Closed conversation",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await req("/tickets/" + t.id + "/reply", tokens.customer, {
        message: "The issue is still unresolved.",
      })
    ).status,
    200,
  );
  const records = (
    await req("/records/tickets?status=open&priority=high", tokens.owner)
  ).data.rows;
  const reopened = records.find((r) => r.id === t.id);
  assert.equal(reopened.status, "open");
  assert.equal(reopened.resolvedAt, undefined);
  assert.equal(reopened.messages.length, 4);
  assert.equal(
    reopened.messages[2].message,
    "We have contacted the professional and agreed on a follow-up.",
  );
  assert.equal(
    (await req("/records/tickets?status=open", tokens.customer)).status,
    403,
  );
  assert.equal(
    (
      await req("/tickets", tokens.customer, {
        message: "Invalid booking reference",
        bookingId: "missing",
      })
    ).status,
    404,
  );
  const pro = (
    await req("/tickets", tokens.professional, {
      message: "Please help update my schedule.",
      category: "schedule",
    })
  ).data;
  assert.equal(
    (
      await req("/tickets/" + pro.id + "/reply", tokens.customer, {
        message: "Not my ticket",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await req("/tickets/" + pro.id + "/reply", tokens.professional, {
        message: "Here are my available hours.",
      })
    ).status,
    200,
  );
});

test("About Us drafts stay private; only Owner can publish, update or unpublish", async () => {
  const content = {
    title: "About our company",
    intro: "We help our community with everyday home services.",
    story:
      "Our company story is reviewed by the Owner before it is shared with customers.",
    mission: "Clear service details",
    values: "Care and reliability",
    serviceArea: "Shadnagar",
  };
  assert.equal((await req("/public/about", "")).data.content, null);
  for (const role of ["customer", "professional", "care"]) {
    assert.equal((await req("/about", tokens[role])).status, 403);
    assert.equal(
      (
        await req(
          "/about",
          tokens[role],
          { action: "publish", revision: 0, content },
          "PUT",
        )
      ).status,
      403,
    );
  }
  const initial = await req("/about", tokens.owner);
  assert.equal(initial.data.revision, 0);
  const saved = await req(
    "/about",
    tokens.owner,
    { action: "save", revision: 0, content },
    "PUT",
  );
  assert.equal(saved.status, 200);
  assert.equal((await req("/public/about", "")).data.content, null);
  assert.equal(
    (
      await req(
        "/about",
        tokens.owner,
        { action: "publish", revision: 1, content: { ...content, story: "" } },
        "PUT",
      )
    ).status,
    400,
  );
  const published = await req(
    "/about",
    tokens.owner,
    { action: "publish", revision: 1, content },
    "PUT",
  );
  assert.equal(published.status, 200);
  assert.deepEqual((await req("/public/about", "")).data.content, content);
  assert.equal(
    (
      await req(
        "/about",
        tokens.owner,
        { action: "save", revision: 1, content },
        "PUT",
      )
    ).status,
    409,
  );
  const draft = {
    ...content,
    story:
      "Private draft: a new story that is not ready for the public website yet.",
  };
  assert.equal(
    (
      await req(
        "/about",
        tokens.owner,
        { action: "save", revision: 2, content: draft },
        "PUT",
      )
    ).status,
    200,
  );
  assert.equal(
    (await req("/public/about", "")).data.content.story,
    content.story,
  );
  assert.equal(
    (
      await req(
        "/about",
        tokens.owner,
        {
          action: "publish",
          revision: 3,
          content: { ...content, title: "x".repeat(121) },
        },
        "PUT",
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await req(
        "/about",
        tokens.owner,
        { action: "unpublish", revision: 3, content: draft },
        "PUT",
      )
    ).status,
    200,
  );
  assert.equal((await req("/public/about", "")).data.content, null);
  assert.equal(
    (await req("/about", tokens.owner)).data.draft.story,
    draft.story,
  );
});
