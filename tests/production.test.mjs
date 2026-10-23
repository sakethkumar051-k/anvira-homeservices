import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createApplication } from "../server/app.mjs";
import {
  createSQLiteStore,
  createFirestoreStore,
} from "../server/lib/store.mjs";
import { seedDemo } from "../server/lib/seed.mjs";
import { config } from "../server/lib/config.mjs";
import { createGateway, validSignature } from "../server/lib/gateway.mjs";
import { slotFor, validateSlot } from "../server/lib/domain.mjs";
import { randomUUID } from "node:crypto";
const date = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
  slot = slotFor(date, 12),
  payload = (key) => ({
    serviceId: "cleaning",
    addons: [],
    address: { line: "12 Garden Street, Shadnagar", pin: "509216" },
    slot,
    idempotencyKey: key,
  });
const signed = (body, secret = "webhook-test-secret") =>
  createHmac("sha256", secret).update(body).digest("hex");
async function fixture(live = true, overrides = {}) {
  const store = await createSQLiteStore(":memory:");
  await seedDemo(store);
  await store.transaction(async (tx) => {
    if (live)
      for (const service of await tx.list("services"))
        tx.put("services", { ...service, sample: false });
    const settings = await tx.get("settings", "company");
    tx.put("settings", {
      ...settings,
      termsUrl: "https://anvira.test/terms",
      privacyUrl: "https://anvira.test/privacy",
      supportPhone: "+919876543210",
    });
    tx.put("users", {
      id: "pro-2",
      name: "Partner",
      role: "professional",
      active: true,
    });
  });
  const cfg = live
    ? config({
        APP_MODE: "firebase",
        NODE_ENV: "production",
        PUBLIC_API_URL: "https://anvira.test",
        ALLOWED_ORIGINS: "https://anvira.test",
        RAZORPAY_KEY_ID: "rzp_test_public",
        RAZORPAY_KEY_SECRET: "checkout-test-secret",
        RAZORPAY_WEBHOOK_SECRET: "webhook-test-secret",
        RAZORPAYX_WEBHOOK_SECRET: "x-webhook-secret",
      })
    : config({ APP_MODE: "demo" });
  let counter = 0;
  const payments = new Map();
  const gateway = {
    async order(b) {
      return {
        id: "order_" + ++counter,
        amount: b.total * 100,
        currency: "INR",
      };
    },
    async payment(id) {
      return payments.get(id);
    },
    async refund(b) {
      return { id: "rfnd_" + b.id.replaceAll("-", ""), status: "processed" };
    },
    async fundAccount(u, d) {
      return {
        contactId: "cont_1",
        fundAccountId: "fa_1",
        last4: d.accountNumber.slice(-4),
      };
    },
    async validateBank(p, id) {
      return {
        id: "fav_" + id.replaceAll("-", ""),
        status: "completed",
        amount: 100,
        currency: "INR",
        fund_account: { id: p.fundAccountId },
        results: {
          account_status: "active",
          registered_name: p.bankHolderName,
        },
      };
    },
    async payout(p) {
      return { id: "pout_" + p.id.replaceAll("-", ""), status: "processed" };
    },
    ...overrides,
  };
  const claims = {
    customer: { uid: "customer-1", name: "Ananya" },
    googleNew: {
      uid: "google-new",
      name: "Google Customer",
      email: "google@example.test",
      firebase: { sign_in_provider: "google.com" },
      role: "owner",
    },
    passwordNew: {
      uid: "email-new",
      name: "Email Customer",
      email: "email@example.test",
      firebase: { sign_in_provider: "password" },
    },
    owner: { uid: "owner-1", role: "owner" },
    care: { uid: "care-1", role: "care" },
    partner: { uid: "pro-2" },
    pro: { uid: "pro-1" },
    forged: { uid: "customer-1", role: "owner" },
    stale: {
      uid: "owner-1",
      role: "owner",
      auth_time: Date.now() / 1000 - 600,
    },
  };
  const authUsers = new Map(
    (await store.list("users"))
      .filter((u) => u.email)
      .map((u) => [u.email.toLowerCase(), { uid: u.id, email: u.email }]),
  );
  const authCalls = [];
  const firebase = {
    auth: {
      async verifyIdToken(token) {
        if (!claims[token]) throw Error("Invalid token");
        return { auth_time: Date.now() / 1000, ...claims[token] };
      },
      async verifySessionCookie(cookie) {
        if (!cookie.startsWith("session.")) throw Error("Invalid cookie");
        return this.verifyIdToken(cookie.slice(8));
      },
      async createSessionCookie(token) {
        return "session." + token;
      },
      async createUser(value) {
        authCalls.push({ action: "create", ...value });
        if (authUsers.has(value.email))
          throw Object.assign(Error("Email exists"), {
            code: "auth/email-already-exists",
          });
        const user = { ...value, uid: "staff-" + randomUUID() };
        authUsers.set(value.email, user);
        claims[user.uid] = {
          uid: user.uid,
          email: user.email,
          firebase: { sign_in_provider: "password" },
        };
        return user;
      },
      async setCustomUserClaims(uid, value) {
        authCalls.push({ action: "claims", uid, value });
        if (claims[uid]) Object.assign(claims[uid], value);
      },
      async updateUser(uid, value) {
        authCalls.push({ action: "update", uid, ...value });
        const user = [...authUsers.values()].find((u) => u.uid === uid);
        if (user) Object.assign(user, value);
        return user;
      },
      async deleteUser(uid) {
        authCalls.push({ action: "delete", uid });
        for (const [email, user] of authUsers)
          if (user.uid === uid) authUsers.delete(email);
        delete claims[uid];
      },
    },
  };
  const application = await createApplication({
    config: cfg,
    store,
    firebase,
    gateway,
  });
  const server = application.app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.on("listening", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  async function req(path, token = "customer", body, method, headers = {}) {
    const response = await fetch(base + "/api" + path, {
      method: method || (body ? "POST" : "GET"),
      headers: {
        ...(body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...headers,
      },
      body:
        body instanceof FormData
          ? body
          : body
            ? JSON.stringify(body)
            : undefined,
    });
    return {
      status: response.status,
      headers: response.headers,
      data: response.headers.get("content-type")?.includes("application/json")
        ? await response.json()
        : await response.text(),
    };
  }
  return {
    ...application,
    req,
    base,
    payments,
    firebase,
    authUsers,
    authCalls,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      store.close();
    },
  };
}
test("Owner creates password-based Care credentials without persisting or returning the password", async () => {
  const f = await fixture();
  try {
    const body = {
      name: "New Care",
      email: " NEWCARE@example.test ",
      password: "StaffFixture!234",
      role: "care",
    };
    const result = await f.req("/staff", "owner", body);
    assert.equal(result.status, 201);
    assert.deepEqual(Object.keys(result.data), ["id"]);
    const record = await f.store.get("users", result.data.id);
    assert.equal(record.role, "care");
    assert.equal(record.email, "newcare@example.test");
    assert.equal(record.active, true);
    assert.equal("password" in record, false);
    assert.equal(f.authCalls[0].password, body.password);
    assert.equal(f.authCalls[0].disabled, true);
    assert.equal(f.authUsers.get(record.email).disabled, false);
    assert.deepEqual(
      f.authCalls.find((call) => call.action === "claims").value,
      { role: "care" },
    );
    const state = await f.req("/state", record.id);
    assert.equal(state.status, 200);
    assert.equal(state.data.user.role, "care");
    assert.equal(JSON.stringify(state.data).includes(body.password), false);
    assert.equal(
      JSON.stringify(await f.store.list("audit")).includes(body.password),
      false,
    );
    assert.equal(
      (
        await f.req("/staff", record.id, {
          ...body,
          email: "other@example.test",
        })
      ).status,
      403,
    );
  } finally {
    await f.close();
  }
});
test("staff provisioning requires a password and refuses existing identities without modifying them", async () => {
  const f = await fixture();
  try {
    const body = {
      name: "Care",
      email: "staff-existing@example.test",
      role: "care",
      password: "StaffFixture!234",
    };
    f.authUsers.set(body.email, { uid: "customer-1", email: body.email });
    const original = await f.store.get("users", "customer-1");
    assert.equal(
      (await f.req("/staff", "owner", { ...body, password: undefined })).status,
      400,
    );
    assert.equal(
      (await f.req("/staff", "owner", { ...body, password: "short" })).status,
      400,
    );
    assert.equal((await f.req("/staff", "customer", body)).status, 403);
    assert.equal((await f.req("/staff", "owner", body)).status, 409);
    assert.equal(f.authCalls.length, 1);
    assert.deepEqual(await f.store.get("users", "customer-1"), original);
  } finally {
    await f.close();
  }
});
test("failed staff provisioning disables and removes only its new identity", async () => {
  const f = await fixture();
  try {
    const update = f.firebase.auth.updateUser;
    f.firebase.auth.updateUser = async (uid, value) => {
      if (!value.disabled)
        throw Object.assign(Error("Provider unavailable"), { status: 503 });
      return update(uid, value);
    };
    const body = {
      name: "Care",
      email: "failedstaff@example.test",
      role: "care",
      password: "StaffFixture!234",
    };
    assert.equal((await f.req("/staff", "owner", body)).status, 503);
    const uid =
      f.authCalls[0].uid ||
      f.authCalls.find((call) => call.action === "claims").uid;
    assert.equal(f.authUsers.has(body.email), false);
    assert.equal(await f.store.get("users", uid), null);
    assert.equal(
      f.authCalls.some((call) => call.action === "update" && call.disabled),
      true,
    );
    assert.equal((await f.store.get("users", "owner-1")).role, "owner");
  } finally {
    await f.close();
  }
});
test("production refuses demo authentication, simulated payments, and broad origin defaults", () => {
  assert.throws(() => config({ NODE_ENV: "production" }), /Firebase/);
  assert.throws(
    () => config({ APP_MODE: "firebase", PAYMENT_MODE: "demo" }),
    /Razorpay/,
  );
  assert.throws(
    () => config({ APP_MODE: "firebase", NODE_ENV: "production" }),
    /ALLOWED_ORIGINS/,
  );
});
test("Indian slots are independent of server timezone and reject half-hour/off-hour bookings", () => {
  assert.equal(new Date(slot).toISOString().slice(11, 16), "06:30");
  assert.doesNotThrow(() => validateSlot(slot));
  assert.throws(() => validateSlot(slot + 1800000), /available service time/);
});
test("HMAC verification rejects modified payloads and malformed signatures", () => {
  const body = '{"amount":123}';
  assert.equal(validSignature(body, signed(body), "webhook-test-secret"), true);
  assert.equal(
    validSignature(body + "x", signed(body), "webhook-test-secret"),
    false,
  );
  assert.equal(
    validSignature(body, "é".repeat(64), "webhook-test-secret"),
    false,
  );
});
test("verified Firebase identity controls roles; payload/claimed owner cannot elevate a customer", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.req("/state", "missing")).status, 401);
    assert.equal(
      (await f.req("/services/cleaning", "forged", { price: 1 }, "PATCH"))
        .status,
      403,
    );
    assert.equal((await f.req("/session", "", { role: "owner" })).status, 403);
    assert.equal(
      (await f.req("/services/cleaning", "care", { price: 1 }, "PATCH")).status,
      403,
    );
    const state = await f.req("/state", "customer");
    assert.equal(state.data.user.role, "customer");
    assert.equal(state.headers.get("cache-control"), "no-store");
    assert.equal(state.data.professionals[0].documents, undefined);
    const care = await f.req("/state", "care");
    assert.equal(care.data.professionals[0].documents, undefined);
  } finally {
    await f.close();
  }
});
test("Firebase Hosting session cookie and session-bound CSRF protect browser mutations", async () => {
  const f = await fixture();
  try {
    const csrf = await f.req("/csrf", "");
    const preauth = csrf.headers.get("set-cookie").split(";")[0];
    assert.ok(preauth.startsWith("__session="));
    assert.equal(
      (
        await f.req("/session", "", { idToken: "owner" }, undefined, {
          Cookie: preauth,
          Origin: "https://evil.test",
          "X-CSRF-Token": csrf.data.token,
        })
      ).status,
      403,
    );
    const login = await f.req("/session", "", { idToken: "owner" }, undefined, {
      Cookie: preauth,
      Origin: "https://anvira.test",
      "X-CSRF-Token": csrf.data.token,
    });
    assert.equal(login.status, 200);
    assert.match(login.headers.get("set-cookie"), /HttpOnly/);
    assert.match(login.headers.get("set-cookie"), /Secure/);
    const session = login.headers.get("set-cookie").split(";")[0];
    const latest = await f.req("/csrf", "", undefined, undefined, {
      Cookie: session,
    });
    assert.notEqual(latest.data.token, csrf.data.token);
    assert.equal(
      (
        await f.req("/services/cleaning", "", { price: 1700 }, "PATCH", {
          Cookie: session,
          Origin: "https://anvira.test",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await f.req("/services/cleaning", "", { price: 1700 }, "PATCH", {
          Cookie: session,
          Origin: "https://anvira.test",
          "X-CSRF-Token": latest.data.token,
        })
      ).status,
      200,
    );
  } finally {
    await f.close();
  }
});
test("live payment callback uses stored order, validates exact amount, and remains idempotent", async () => {
  const f = await fixture();
  try {
    const booking = (
      await f.req("/bookings", "customer", payload("live-booking-001"))
    ).data;
    assert.equal(
      (
        await f.req("/bookings/" + booking.id + "/action", "customer", {
          action: "pay",
        })
      ).status,
      403,
    );
    const result = await f.req(
      "/bookings/" + booking.id + "/payment/order",
      "customer",
      {},
    );
    assert.equal(result.status, 200);
    const b = await f.store.get("bookings", booking.id);
    f.payments.set("pay_1", {
      id: "pay_1",
      order_id: b.orderId,
      amount: b.total * 100,
      currency: "INR",
      status: "captured",
    });
    const body = {
      razorpay_payment_id: "pay_1",
      razorpay_signature: signed(b.orderId + "|pay_1", "checkout-test-secret"),
    };
    assert.equal(
      (
        await f.req("/bookings/" + b.id + "/payment/verify", "customer", {
          ...body,
          razorpay_signature: "0".repeat(64),
        })
      ).status,
      400,
    );
    const verified = await f.req(
      "/bookings/" + b.id + "/payment/verify",
      "customer",
      body,
    );
    assert.equal(verified.data.payment, "paid");
    assert.equal(verified.data.status, "assigned");
    assert.equal(
      (await f.req("/bookings/" + b.id + "/payment/verify", "customer", body))
        .status,
      200,
    );
    const event = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: f.payments.get("pay_1") } },
    });
    const response = await fetch(f.base + "/api/webhooks/razorpay", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Razorpay-Signature": signed(event),
      },
      body: event,
    });
    assert.equal(response.status, 200);
    assert.equal((await f.store.list("bookings")).length, 1);
    assert.equal((await f.store.list("ledger")).length, 0);
  } finally {
    await f.close();
  }
});
test("invalid webhook signatures and mismatched captured amounts never mark bookings paid", async () => {
  const f = await fixture();
  try {
    const b = (
      await f.req("/bookings", "customer", payload("webhook-booking-001"))
    ).data;
    await f.req("/bookings/" + b.id + "/payment/order", "customer", {});
    const linked = await f.store.get("bookings", b.id),
      event = JSON.stringify({
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_wrong",
              order_id: linked.orderId,
              amount: 1,
              currency: "INR",
              status: "captured",
            },
          },
        },
      });
    for (const signature of ["0".repeat(64), signed(event)]) {
      const r = await fetch(f.base + "/api/webhooks/razorpay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Razorpay-Signature": signature,
        },
        body: event,
      });
      assert.equal(r.status, 400);
    }
    assert.equal((await f.store.get("bookings", b.id)).payment, "pending");
  } finally {
    await f.close();
  }
});
test("late captured payment triggers one full refund instead of resurrecting expired booking", async () => {
  const f = await fixture();
  try {
    const b = (
      await f.req("/bookings", "customer", payload("late-booking-001"))
    ).data;
    await f.req("/bookings/" + b.id + "/payment/order", "customer", {});
    await f.jobs.maintenance(Date.now() + 16 * 60000);
    const linked = await f.store.get("bookings", b.id);
    assert.equal(linked.status, "payment_expired");
    const payment = {
      id: "pay_late",
      order_id: linked.orderId,
      amount: linked.total * 100,
      currency: "INR",
      status: "captured",
    };
    await f.business.paymentCaptured(payment, "late-capture");
    await f.business.paymentCaptured(payment, "late-capture");
    await Promise.all([f.jobs.financialJobs(), f.jobs.financialJobs()]);
    const refunded = await f.store.get("bookings", b.id);
    assert.equal(refunded.status, "cancelled");
    assert.equal(refunded.payment, "refunded");
    assert.equal((await f.store.list("jobs")).length, 1);
  } finally {
    await f.close();
  }
});
test("ambiguous refund outcome is held for reconciliation, never silently retried", async () => {
  let calls = 0;
  const f = await fixture(true, {
    async refund() {
      calls++;
      throw Error("Network timeout after provider request");
    },
  });
  try {
    await f.store.transaction(async (tx) => {
      tx.put("bookings", {
        id: "financial-booking",
        payment: "paid",
        total: 100,
        customerId: "customer-1",
        paymentId: "pay_test",
        refund: "processing",
      });
      tx.put("jobs", {
        id: "refund_financial-booking",
        type: "refund",
        bookingId: "financial-booking",
        status: "pending",
        attempts: 0,
        dueAt: 0,
        createdAt: 0,
      });
    });
    await f.jobs.financialJobs();
    await f.jobs.financialJobs();
    assert.equal(calls, 1);
    assert.equal(
      (await f.store.get("jobs", "refund_financial-booking")).status,
      "needs_reconciliation",
    );
  } finally {
    await f.close();
  }
});
test("refund arriving during outbound request preserves completed status", async () => {
  let f;
  f = await fixture(true, {
    async refund(b) {
      await f.store.transaction(async (tx) => {
        const current = await tx.get("bookings", b.id);
        tx.put("bookings", {
          ...current,
          refund: "refunded",
          payment: "refunded",
        });
      });
      return { id: "rfnd_early", status: "pending" };
    },
  });
  try {
    await f.store.transaction(async (tx) => {
      tx.put("bookings", {
        id: "early-refund",
        payment: "paid",
        total: 100,
        customerId: "customer-1",
        paymentId: "pay_test",
        refund: "processing",
      });
      tx.put("jobs", {
        id: "refund_early-refund",
        type: "refund",
        bookingId: "early-refund",
        status: "pending",
        attempts: 0,
        dueAt: 0,
        createdAt: 0,
      });
    });
    await f.jobs.financialJobs();
    assert.equal(
      (await f.store.get("bookings", "early-refund")).refund,
      "refunded",
    );
    assert.equal(
      (await f.store.get("jobs", "refund_early-refund")).status,
      "done",
    );
  } finally {
    await f.close();
  }
});
test("saved addresses are owned, offer quotes do not consume usage, support replies are visible", async () => {
  const f = await fixture();
  try {
    const a = await f.req("/addresses", "customer", {
      label: "Home",
      line: "12 Garden Street, Shadnagar",
      pin: "509216",
    });
    assert.equal(a.status, 201);
    assert.equal(
      (await f.req("/addresses/" + a.data.id, "partner", undefined, "DELETE"))
        .status,
      403,
    );
    await f.req(
      "/promotions",
      "owner",
      {
        id: "WELCOME",
        discountAmount: 100,
        minAmount: 500,
        maxUses: 1,
        expiresAt: Date.now() + 86400000,
        active: true,
      },
      "PUT",
    );
    const quote = await f.req("/quote", "customer", {
      serviceId: "cleaning",
      addons: [],
      promoCode: "WELCOME",
    });
    assert.equal(quote.data.total, 1399);
    assert.equal((await f.store.get("promotions", "WELCOME")).uses, 0);
    const booking = await f.req("/bookings", "customer", {
      ...payload("offer-booking-001"),
      promoCode: "WELCOME",
    });
    assert.equal(booking.data.total, 1399);
    assert.equal((await f.store.get("promotions", "WELCOME")).uses, 1);
    const t = await f.req("/tickets", "customer", {
      message: "Please check this service booking.",
    });
    assert.equal(
      (
        await f.req("/tickets/" + t.data.id + "/reply", "care", {
          message: "We are reviewing it now.",
        })
      ).status,
      200,
    );
    assert.equal(
      (await f.req("/state", "customer")).data.tickets[0].messages[0].message,
      "We are reviewing it now.",
    );
  } finally {
    await f.close();
  }
});
test("partner earnings use a commission snapshot and payout approval settles held balance once", async () => {
  const f = await fixture(false);
  try {
    const customer = (await f.req("/session", "", { role: "customer" })).data
        .token,
      owner = (await f.req("/session", "", { role: "owner" })).data.token,
      partner = (
        await f.req("/session", "", {
          role: "professional",
          professionalId: "pro-2",
        })
      ).data.token;
    await f.store.transaction(async (tx) => {
      const p = await tx.get("professionals", "pro-1");
      tx.put("professionals", { ...p, available: false });
    });
    const b = (
      await f.req("/bookings", customer, payload("partner-earning-001"))
    ).data;
    await f.req("/bookings/" + b.id + "/action", customer, { action: "pay" });
    for (const action of ["accept", "start", "complete"])
      assert.equal(
        (
          await f.req("/bookings/" + b.id + "/action", partner, {
            action,
            checklist: [true, true, true, true, true],
          })
        ).status,
        200,
      );
    assert.equal((await f.store.get("wallets", "pro-2")).available, 1199);
    assert.equal((await f.store.list("ledger")).length, 1);
    await f.req("/professional/bank", partner, {
      name: "Partner",
      accountNumber: "123456789012",
      ifsc: "SBIN0001234",
    });
    assert.equal(
      (await f.req("/professional/bank/verify", partner, { consent: true }))
        .data.status,
      "verified",
    );
    const payout = await f.req("/payouts", partner, {
      amount: 1000,
      idempotencyKey: "withdrawal-request-001",
    });
    assert.equal(payout.status, 201);
    assert.equal((await f.store.get("wallets", "pro-2")).held, 1000);
    assert.equal(
      (
        await f.req("/payouts", partner, {
          amount: 1000,
          idempotencyKey: "withdrawal-request-001",
        })
      ).data.id,
      payout.data.id,
    );
    assert.equal(
      (await f.req("/payouts/" + payout.data.id + "/approve", owner, {})).data
        .status,
      "paid",
    );
    assert.equal((await f.store.get("wallets", "pro-2")).paid, 1000);
    assert.equal(
      (await f.req("/payouts/" + payout.data.id + "/approve", owner, {}))
        .status,
      409,
    );
    const profile = await f.store.get("professionals", "pro-2");
    assert.equal(profile.bankLast4, "9012");
    assert.equal(profile.accountNumber, undefined);
  } finally {
    await f.close();
  }
});
test("financial staff changes require a recent authenticated sign-in", async () => {
  const f = await fixture();
  try {
    assert.equal(
      (
        await f.req("/staff", "stale", {
          email: "care@example.com",
          name: "Care staff",
          role: "care",
        })
      ).status,
      401,
    );
  } finally {
    await f.close();
  }
});
test("private document uploads reject disguised files and live approval requires verification", async () => {
  const f = await fixture();
  try {
    const approved = await f.req("/professionals/pro-3/approve", "owner", {
      verificationConfirmed: "yes",
    });
    assert.equal(approved.status, 400);
    await f.req("/professional/onboard", "customer", {
      name: "New Partner",
      skills: ["cleaning"],
      pins: ["509216"],
      experienceYears: 4,
      bio: "Careful home cleaning.",
      termsAccepted: true,
    });
    const form = new FormData();
    form.append("kind", "identity");
    form.append(
      "file",
      new Blob(["not a pdf"], { type: "application/pdf" }),
      "fake.pdf",
    );
    assert.equal(
      (await f.req("/professional/documents", "customer", form)).status,
      400,
    );
    assert.equal(
      (await f.req("/professionals/customer-1/documents/missing", "care"))
        .status,
      403,
    );
  } finally {
    await f.close();
  }
});
test("account deletion removes personal addresses/profile and rejects active work", async () => {
  const f = await fixture();
  try {
    await f.req("/addresses", "customer", {
      line: "12 Garden Street, Shadnagar",
      pin: "509216",
    });
    const deleted = await f.req("/account", "customer", undefined, "DELETE");
    assert.equal(deleted.status, 200);
    assert.equal((await f.store.list("addresses")).length, 0);
    assert.equal(
      (await f.store.get("users", "customer-1")).name,
      "Deleted account",
    );
    assert.equal((await f.req("/state", "customer")).status, 403);
  } finally {
    await f.close();
  }
});
test("Razorpay adapter sends paisa amounts and payout idempotency keys without storing bank details", async () => {
  const calls = [];
  const gateway = createGateway(
    {
      paymentMode: "razorpay",
      razorpayKeyId: "public",
      razorpayKeySecret: "private",
      payoutsEnabled: true,
      payoutAccount: "123",
      razorpayXKeyId: "xpublic",
      razorpayXKeySecret: "xprivate",
    },
    async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => ({ id: "provider_id" }) };
    },
  );
  await gateway.order({ id: "booking", total: 1499 });
  await gateway.payout(
    { id: "payout-key-001", amount: 1000 },
    { fundAccountId: "fa_1" },
  );
  assert.equal(JSON.parse(calls[0].options.body).amount, 149900);
  assert.equal(
    calls[1].options.headers["X-Payout-Idempotency"],
    "payout-key-001",
  );
  assert.equal(
    calls[1].options.headers.Authorization,
    "Basic " + Buffer.from("xpublic:xprivate").toString("base64"),
  );
});
test("Firestore unit of work buffers writes until all transaction reads are finished", async () => {
  const events = [],
    values = new Map([["users/a", { id: "a", name: "Before" }]]);
  const db = {
    collection(kind) {
      return {
        doc(id) {
          return { path: kind + "/" + id };
        },
      };
    },
    async runTransaction(fn) {
      return fn({
        async get(ref) {
          events.push("read");
          return {
            exists: values.has(ref.path),
            id: ref.path.split("/")[1],
            data: () => values.get(ref.path),
          };
        },
        set(ref, value) {
          events.push("write");
          values.set(ref.path, value);
        },
        delete() {
          events.push("delete");
        },
      });
    },
  };
  const store = createFirestoreStore(db);
  await store.transaction(async (tx) => {
    const a = await tx.get("users", "a");
    tx.put("users", { ...a, name: "After" });
    assert.equal((await tx.get("users", "a")).name, "After");
    await tx.get("users", "missing");
  });
  assert.deepEqual(events, ["read", "read", "write"]);
  assert.equal(values.get("users/a").name, "After");
});

test("Router query decoding handles malformed links without recursive decoding", async () => {
  const { createRequire } = await import("node:module"),
    require = createRequire(import.meta.url),
    query = require("query-string");
  const text = "ఇంటి సేవలు";
  assert.equal(query.parse("q=" + encodeURIComponent(text)).q, text);
  assert.equal(query.parse("q=hello+world").q, "hello world");
  const malformed = "%FF".repeat(3000),
    start = performance.now();
  const result = query.parse("q=" + malformed);
  assert.equal(result.q, malformed);
  assert.ok(
    performance.now() - start < 1000,
    "Malformed URL decoding exceeded bounded processing budget.",
  );
});

test("assignment timeout tries a second professional, then refunds an unfulfilled service", async () => {
  const f = await fixture(),
    originalNow = Date.now;
  let clock = originalNow();
  Date.now = () => clock;
  try {
    const b = (
      await f.req("/bookings", "customer", payload("timeout-assignment-001"))
    ).data;
    await f.req("/bookings/" + b.id + "/payment/order", "customer", {});
    const linked = await f.store.get("bookings", b.id);
    await f.business.paymentCaptured(
      {
        id: "pay_timeout",
        order_id: linked.orderId,
        amount: linked.total * 100,
        currency: "INR",
        status: "captured",
      },
      "timeout-capture",
    );
    clock += 31 * 60000;
    await f.jobs.maintenance();
    const second = await f.store.get("bookings", b.id);
    assert.equal(second.professionalId, "pro-2");
    clock += 31 * 60000;
    await f.jobs.maintenance();
    const cancelled = await f.store.get("bookings", b.id);
    assert.equal(cancelled.status, "cancelled");
    await f.jobs.financialJobs();
    assert.equal((await f.store.get("bookings", b.id)).payment, "refunded");
  } finally {
    Date.now = originalNow;
    await f.close();
  }
});
test("unpaid expired offer reservation releases promo capacity once", async () => {
  const f = await fixture();
  try {
    await f.req(
      "/promotions",
      "owner",
      {
        id: "LIMITED",
        discountAmount: 100,
        minAmount: 500,
        maxUses: 1,
        expiresAt: Date.now() + 86400000,
        active: true,
      },
      "PUT",
    );
    await f.req("/bookings", "customer", {
      ...payload("expired-offer-001"),
      promoCode: "LIMITED",
    });
    assert.equal((await f.store.get("promotions", "LIMITED")).uses, 1);
    await f.jobs.maintenance(Date.now() + 16 * 60000);
    await f.jobs.maintenance(Date.now() + 17 * 60000);
    assert.equal((await f.store.get("promotions", "LIMITED")).uses, 0);
  } finally {
    await f.close();
  }
});
test("payout processed/reversal webhook duplicates never move wallet balances twice", async () => {
  const f = await fixture();
  try {
    await f.store.transaction(async (tx) => {
      tx.put("wallets", { id: "pro-2", available: 200, held: 1000, paid: 0 });
      tx.put("payouts", {
        id: "wallet-test",
        professionalId: "pro-2",
        gatewayId: "pout_test",
        amount: 1000,
        status: "processing",
        createdAt: Date.now(),
      });
    });
    async function webhook(event, id) {
      const body = JSON.stringify({
        event,
        payload: {
          payout: {
            entity: { id: "pout_test", amount: 100000, currency: "INR" },
          },
        },
      });
      const response = await fetch(f.base + "/api/webhooks/razorpayx", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Razorpay-Signature": signed(body, "x-webhook-secret"),
          "X-Razorpay-Event-Id": id,
        },
        body,
      });
      assert.equal(response.status, 200);
    }
    await webhook("payout.processed", "processed-1");
    await webhook("payout.processed", "processed-1");
    assert.deepEqual(await f.store.get("wallets", "pro-2"), {
      id: "pro-2",
      available: 200,
      held: 0,
      paid: 1000,
    });
    await webhook("payout.reversed", "reversed-1");
    await webhook("payout.reversed", "reversed-1");
    assert.deepEqual(await f.store.get("wallets", "pro-2"), {
      id: "pro-2",
      available: 1200,
      held: 0,
      paid: 0,
    });
  } finally {
    await f.close();
  }
});
test("pagination does not lose bookings created at the same timestamp", async () => {
  const f = await fixture();
  try {
    await f.store.transaction(async (tx) => {
      for (let i = 0; i < 105; i++)
        tx.put("bookings", {
          id: "cursor-" + String(i).padStart(3, "0"),
          createdAt: 100,
          customerId: "customer-1",
        });
    });
    const first = (await f.req("/bookings")).data;
    assert.equal(first.rows.length, 100);
    const second = (
      await f.req(
        "/bookings?cursor=" +
          encodeURIComponent(JSON.stringify(first.nextCursor)),
      )
    ).data;
    assert.equal(second.rows.length, 5);
    assert.equal(
      new Set([...first.rows, ...second.rows].map((b) => b.id)).size,
      105,
    );
  } finally {
    await f.close();
  }
});

test("professional workspace switching preserves personal bookings and never elevates a customer", async () => {
  const f = await fixture();
  try {
    await f.store.transaction(async (tx) => {
      tx.put("bookings", {
        id: "partner-personal",
        customerId: "pro-2",
        status: "completed",
        createdAt: Date.now(),
      });
    });
    const personal = await f.req("/state", "partner", undefined, undefined, {
      "X-Anvira-Workspace": "customer",
    });
    assert.equal(personal.data.user.role, "customer");
    assert.equal(personal.data.user.primaryRole, "professional");
    assert.equal(personal.data.bookings[0].id, "partner-personal");
    assert.equal(
      (await f.req("/state", "partner")).data.user.role,
      "professional",
    );
    const forged = await f.req("/state", "customer", undefined, undefined, {
      "X-Anvira-Workspace": "professional",
    });
    assert.equal(forged.data.user.role, "customer");
    assert.equal(
      (
        await f.req("/services/cleaning", "partner", { price: 1 }, "PATCH", {
          "X-Anvira-Workspace": "owner",
        })
      ).status,
      403,
    );
  } finally {
    await f.close();
  }
});

test("server aggregates all 1105 bookings and protects Owner financial totals from Care", async () => {
  const f = await fixture();
  try {
    const now = Date.now();
    await f.store.transaction(async (tx) => {
      for (let i = 0; i < 1105; i++)
        tx.put("bookings", {
          id: "report-" + i,
          createdAt: now,
          slot: now,
          serviceId: "cleaning",
          status: "completed",
          total: 10,
          payment: i === 0 ? "refunded" : "paid",
        });
    });
    const summary = await f.req("/reports/summary", "owner");
    assert.equal(summary.status, 200);
    assert.equal(summary.data.bookings, 1105);
    assert.equal(summary.data.completedValue, 11050);
    assert.equal(summary.data.capturedValue, 11050);
    assert.equal(summary.data.netCapturedValue, 11040);
    const period = await f.req(
      "/reports/summary?from=" + (now - 1000) + "&to=" + (now + 1000),
      "owner",
    );
    assert.equal(
      period.data.services.find((s) => s.id === "cleaning").completed,
      1105,
    );
    const care = await f.req("/reports/summary", "care");
    assert.equal(care.data.completed, 1105);
    assert.equal(care.data.completedValue, null);
    assert.equal(care.data.netCapturedValue, null);
    assert.equal((await f.req("/reports/summary", "customer")).status, 403);
    assert.equal(
      (await f.req("/reports/summary?from=100&to=1", "owner")).status,
      400,
    );
  } finally {
    await f.close();
  }
});
test("operational pagination preserves tied records and never exposes another customer's notifications or private Care documents", async () => {
  const f = await fixture();
  try {
    await f.store.transaction(async (tx) => {
      for (let i = 0; i < 205; i++)
        tx.put("notifications", {
          id: "page-" + String(i).padStart(3, "0"),
          userId: "customer-1",
          title: "Booking",
          createdAt: 100,
        });
      tx.put("notifications", {
        id: "foreign",
        userId: "pro-2",
        title: "Private",
        createdAt: 101,
      });
      const pro = await tx.get("professionals", "pro-1");
      tx.put("professionals", {
        ...pro,
        documents: [{ id: "private-doc" }],
        bankLast4: "1234",
      });
    });
    let cursor = null,
      ids = [];
    do {
      const page = await f.req(
        "/records/notifications" +
          (cursor
            ? "?cursor=" + encodeURIComponent(JSON.stringify(cursor))
            : ""),
      );
      assert.equal(page.status, 200);
      ids.push(...page.data.rows.map((r) => r.id));
      cursor = page.data.nextCursor;
    } while (cursor);
    assert.equal(ids.length, 205);
    assert.equal(new Set(ids).size, 205);
    assert.ok(!ids.includes("foreign"));
    const care = await f.req("/records/professionals", "care");
    assert.equal(
      care.data.rows.find((p) => p.id === "pro-1").documents,
      undefined,
    );
    assert.equal((await f.req("/records/audit", "care")).status, 403);
    assert.equal((await f.req("/records/staff", "customer")).status, 403);
    assert.equal(
      (await f.req("/records/notifications?cursor=broken")).status,
      400,
    );
  } finally {
    await f.close();
  }
});
test("booking conversation is private, retry-safe, read-only after cancellation, and deletes the sender's content with the account", async () => {
  const f = await fixture();
  try {
    const id = randomUUID();
    await f.store.transaction(async (tx) =>
      tx.put("bookings", {
        id,
        customerId: "customer-1",
        customerName: "Ananya",
        professionalId: "pro-1",
        status: "confirmed",
        payment: "paid",
        total: 100,
        createdAt: Date.now(),
        slot,
        address: { line: "Garden Street", pin: "509216" },
      }),
    );
    const path = "/bookings/" + id + "/messages",
      body = {
        message: "Please bring the cleaning kit.",
        idempotencyKey: "booking-message-001",
      };
    const a = await f.req(path, "customer", body),
      b = await f.req(path, "customer", body);
    assert.equal(a.status, 200);
    assert.equal(a.data.id, b.data.id);
    assert.equal((await f.store.list("messages")).length, 1);
    assert.equal((await f.req(path, "partner")).status, 403);
    assert.equal(
      (
        await f.req(path, "pro", {
          message: "I will bring it.",
          idempotencyKey: "booking-message-002",
        })
      ).status,
      200,
    );
    assert.equal((await f.req(path, "care")).data.rows.length, 2);
    assert.equal(
      (await f.req(path, "customer", { ...body, message: "Different text" }))
        .status,
      409,
    );
    await f.store.transaction(async (tx) => {
      const booking = await tx.get("bookings", id);
      tx.put("bookings", { ...booking, status: "cancelled" });
    });
    assert.equal(
      (
        await f.req(path, "customer", {
          message: "After cancellation",
          idempotencyKey: "booking-message-003",
        })
      ).status,
      409,
    );
    assert.equal((await f.req(path, "pro")).status, 200);
    assert.equal(
      (await f.req("/account", "customer", {}, "DELETE")).status,
      200,
    );
    const messages = await f.store.list("messages");
    assert.equal(
      messages.find((m) => m.senderId === "customer-1").message,
      "Removed after account deletion",
    );
  } finally {
    await f.close();
  }
});

test("expired conversation messages are hidden before cleanup and cannot be replayed", async () => {
  const f = await fixture();
  try {
    const id = randomUUID();
    await f.store.transaction(async (tx) =>
      tx.put("bookings", {
        id,
        customerId: "customer-1",
        professionalId: "pro-1",
        status: "confirmed",
        payment: "paid",
        total: 100,
        createdAt: Date.now(),
        slot,
      }),
    );
    const path = "/bookings/" + id + "/messages";
    const body = {
      message: "Retained temporarily",
      idempotencyKey: "expiry-message-001",
    };
    const sent = await f.req(path, "customer", body);
    assert.equal(sent.status, 200);
    await f.store.transaction(async (tx) => {
      const message = await tx.get("messages", sent.data.id);
      tx.put("messages", { ...message, expiresAt: Date.now() - 1000 });
    });
    assert.equal((await f.store.list("messages")).length, 1);
    assert.deepEqual((await f.req(path, "customer")).data.rows, []);
    assert.deepEqual((await f.req(path, "care")).data.rows, []);
    assert.equal((await f.req(path, "customer", body)).status, 410);
  } finally {
    await f.close();
  }
});

test("authenticated request limits isolate accounts sharing one IP while still blocking an abusive account", async () => {
  const f = await fixture();
  try {
    for (let i = 0; i < 100; i++) {
      assert.equal(
        (await f.req("/records/notifications", "customer")).status,
        200,
      );
      assert.equal((await f.req("/records/notifications", "pro")).status, 200);
    }
    let last;
    for (let i = 0; i < 181; i++) last = await f.req("/records/audit", "owner");
    assert.equal(last.status, 429);
    assert.equal(
      (await f.req("/records/notifications", "customer")).status,
      200,
    );
  } finally {
    await f.close();
  }
});

test("live identities cannot link another customer's or professional's booking to support", async () => {
  const f = await fixture();
  try {
    await f.store.transaction(async (tx) => {
      tx.put("bookings", {
        id: "support-foreign",
        customerId: "someone-else",
        professionalId: "pro-1",
        status: "confirmed",
        createdAt: Date.now(),
      });
    });
    const body = {
      message: "Please investigate this booking.",
      bookingId: "support-foreign",
      category: "quality",
    };
    assert.equal((await f.req("/tickets", "customer", body)).status, 403);
    assert.equal((await f.req("/tickets", "partner", body)).status, 403);
    const own = await f.req("/tickets", "pro", body);
    assert.equal(own.status, 201);
    assert.equal(own.data.priority, "high");
    assert.equal(
      (
        await f.req("/tickets/" + own.data.id + "/reply", "customer", {
          message: "Unrelated customer reply",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await f.req("/tickets/" + own.data.id + "/reply", "care", {
          message: "We will contact your customer.",
        })
      ).status,
      200,
    );
    const saved = await f.store.get("tickets", own.data.id);
    assert.equal(saved.messages[0].sender, "ANVIRA Support");
    assert.equal(
      (await f.req("/records/tickets?priority=high", "owner")).status,
      400,
    );
    assert.equal(
      (await f.req("/records/tickets?status=open&priority=high", "care")).data
        .rows.length,
      1,
    );
  } finally {
    await f.close();
  }
});

test("Firebase quota errors explain workspace failure without reporting an invalid password", async () => {
  const f = await fixture();
  try {
    f.store.get = async () => {
      throw Object.assign(new Error("private database diagnostic"), {
        code: 8,
      });
    };
    const r = await f.req("/state", "owner");
    assert.equal(r.status, 503);
    assert.equal(r.data.code, "DATABASE_QUOTA_EXCEEDED");
    assert.match(r.data.error, /quota.*sign-in/i);
    assert.doesNotMatch(JSON.stringify(r.data), /private database diagnostic/);
  } finally {
    await f.close();
  }
});
test("short support messages and retries create one request and one reply, retaining ownership", async () => {
  const f = await fixture();
  try {
    const input = { message: "Hi", idempotencyKey: "support-retry-123" };
    const a = await f.req("/tickets", "customer", input),
      b = await f.req("/tickets", "customer", input);
    assert.equal(a.status, 201);
    assert.equal(a.data.id, b.data.id);
    assert.equal(
      (await f.store.list("tickets", [["customerId", "==", "customer-1"]]))
        .length,
      1,
    );
    const path = "/tickets/" + a.data.id + "/reply",
      reply = {
        message: "Hello, we can help.",
        idempotencyKey: "reply-retry-123",
      };
    assert.equal((await f.req(path, "care", reply)).status, 200);
    assert.equal((await f.req(path, "care", reply)).status, 200);
    assert.equal((await f.store.get("tickets", a.data.id)).messages.length, 1);
    assert.equal((await f.req(path, "pro", reply)).status, 403);
    assert.equal(
      (await f.req(path, "care", { ...reply, message: "Changed message" }))
        .status,
      409,
    );
  } finally {
    await f.close();
  }
});
const richService = (s) => ({
  ...s,
  packages: [
    {
      id: "deep",
      name: "Deep care",
      description: "Extended cleaning",
      price: 2000,
      duration: 120,
      includes: ["Kitchen deep clean"],
    },
  ],
  optionGroups: [
    {
      id: "size",
      name: "Home size",
      required: true,
      options: [
        { id: "large", name: "Three bedrooms", price: 500, duration: 30 },
        { id: "small", name: "One bedroom", price: 0, duration: 0 },
      ],
    },
  ],
  faqs: [
    {
      question: "Do I need supplies?",
      answer: "Standard supplies are included.",
    },
  ],
  preparation: ["Clear surfaces"],
  warranty: "Contact support to discuss a revisit.",
  checklist: ["Kitchen inspected"],
});
test("custom service choices control quotes, booking snapshots and occupied duration; forged choices fail", async () => {
  const f = await fixture();
  try {
    const service = richService(await f.store.get("services", "cleaning"));
    assert.equal(
      (await f.req("/services/cleaning", "care", service, "PATCH")).status,
      403,
    );
    assert.equal(
      (await f.req("/services/cleaning", "owner", service, "PATCH")).status,
      200,
    );
    const selection = {
      packageId: "deep",
      options: { size: "large" },
      addons: [],
    };
    const quote = await f.req("/quote", "customer", {
      serviceId: "cleaning",
      ...selection,
    });
    assert.equal(quote.status, 200);
    assert.equal(quote.data.total, 2500);
    assert.equal(
      (
        await f.req("/quote", "customer", {
          serviceId: "cleaning",
          options: {},
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await f.req("/quote", "customer", {
          serviceId: "cleaning",
          ...selection,
          packageId: "forged",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await f.req("/quote", "customer", {
          serviceId: "cleaning",
          ...selection,
          options: { size: "large", unknown: "free" },
        })
      ).status,
      400,
    );
    const b = await f.req("/bookings", "customer", {
      ...payload("rich-service-booking"),
      ...selection,
      instructions: "Please ring the side gate.",
    });
    assert.equal(b.status, 201);
    assert.equal(b.data.total, 2500);
    assert.equal(b.data.duration, 150);
    assert.equal(b.data.packageName, "Deep care");
    assert.equal(b.data.instructions, "Please ring the side gate.");
    assert.deepEqual(b.data.serviceChecklist, ["Kitchen inspected"]);
    await f.req(
      "/services/cleaning",
      "owner",
      { ...service, packages: [{ ...service.packages[0], price: 3000 }] },
      "PATCH",
    );
    assert.equal((await f.store.get("bookings", b.data.id)).total, 2500);
    const day = new Date(slot + 330 * 60000).toISOString().slice(0, 10);
    assert.equal(
      (
        await f.req(
          "/availability?serviceId=cleaning&date=" +
            day +
            "&selection=" +
            encodeURIComponent(JSON.stringify(selection)),
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await f.req(
          "/availability?serviceId=cleaning&date=" + day + "&selection=invalid",
        )
      ).status,
      400,
    );
    await f.req(
      "/services/cleaning",
      "owner",
      { ...service, active: false },
      "PATCH",
    );
    assert.equal(
      (
        await f.req(
          "/availability?serviceId=cleaning&date=" +
            day +
            "&bookingId=" +
            b.data.id,
        )
      ).status,
      200,
    );
  } finally {
    await f.close();
  }
});
test("arrival is assigned-professional only and custom completion tasks cannot be skipped", async () => {
  const f = await fixture();
  try {
    const b = {
      ...payload("handover"),
      id: "custom-job",
      customerId: "customer-1",
      customerName: "Ananya",
      professionalId: "pro-1",
      serviceName: "Cleaning",
      duration: 60,
      total: 100,
      price: 100,
      payment: "paid",
      status: "confirmed",
      slot: Date.now() + 600000,
      createdAt: Date.now(),
      serviceChecklist: ["Kitchen inspected"],
      checklist: [],
    };
    await f.store.transaction(async (tx) => tx.put("bookings", b));
    const path = "/bookings/custom-job/action";
    assert.equal(
      (await f.req(path, "customer", { action: "arrive" })).status,
      403,
    );
    assert.equal(
      (await f.req(path, "partner", { action: "arrive" })).status,
      403,
    );
    assert.equal((await f.req(path, "pro", { action: "arrive" })).status, 200);
    await f.req(path, "pro", { action: "arrive" });
    assert.equal(
      (
        await f.store.list("notifications", [["userId", "==", "customer-1"]])
      ).filter((x) => x.title.includes("arrived")).length,
      1,
    );
    assert.equal((await f.req(path, "pro", { action: "start" })).status, 200);
    assert.equal(
      (
        await f.req(path, "pro", {
          action: "complete",
          checklist: [true, true, true],
        })
      ).status,
      400,
    );
    const done = await f.req(path, "pro", {
      action: "complete",
      checklist: [true, true, true, true],
      completionNotes: "Kitchen cleaned. Keep surfaces dry.",
    });
    assert.equal(done.status, 200);
    assert.match(done.data.completionNotes, /surfaces dry/);
  } finally {
    await f.close();
  }
});
test("professional photo and public bio edits preserve approval and reject forged uploads or customer writes", async () => {
  const f = await fixture();
  try {
    const bytes = await readFile(
      new URL("./fixtures/profile.jpg", import.meta.url),
    );
    const image = {
      dataUri: "data:image/jpeg;base64," + bytes.toString("base64"),
    };
    assert.equal(
      (await f.req("/professional/photo", "customer", image)).status,
      403,
    );
    assert.equal(
      (
        await f.req("/professional/photo", "pro", {
          dataUri: "data:image/svg+xml;base64,PHN2Zz4=",
        })
      ).status,
      400,
    );
    assert.equal(
      (await f.req("/professional/photo", "pro", image)).status,
      200,
    );
    assert.equal(
      (await f.req("/professional/pro-1/photo", "customer")).data.dataUri,
      image.dataUri,
    );
    assert.equal(
      (
        await f.req(
          "/professional/profile",
          "pro",
          {
            bio: "Cleaning with care.",
            languages: ["Telugu", "English"],
            approved: false,
          },
          "PATCH",
        )
      ).status,
      200,
    );
    assert.equal((await f.store.get("professionals", "pro-1")).approved, true);
    assert.equal(
      (await f.req("/professional/photo", "pro", undefined, "DELETE")).status,
      200,
    );
    assert.equal(
      (await f.req("/professional/pro-1/photo", "customer")).status,
      404,
    );
  } finally {
    await f.close();
  }
});

test("new Google and password identities are customers; contact phone changes never verify a phone or elevate roles", async () => {
  const f = await fixture();
  try {
    for (const token of ["googleNew", "passwordNew"]) {
      const result = await f.req("/state", token);
      assert.equal(result.status, 200);
      assert.equal(result.data.user.role, "customer");
      assert.equal(result.data.user.phone, "");
      assert.equal(result.data.user.phoneVerified, false);
      assert.equal((await f.req("/settings", token, {}, "PUT")).status, 403);
    }
    assert.equal(
      (
        await f.req(
          "/profile",
          "googleNew",
          {
            name: "New Customer",
            phone: "9876543210",
            role: "owner",
            phoneVerified: true,
          },
          "PATCH",
        )
      ).status,
      200,
    );
    const state = await f.req("/state", "googleNew");
    assert.equal(state.data.user.phone, "+919876543210");
    assert.equal(state.data.user.phoneVerified, false);
    assert.equal(state.data.user.role, "customer");
    assert.equal(state.data.user.name, "New Customer");
    assert.equal(
      (
        await f.req(
          "/profile",
          "googleNew",
          { name: "New Customer", phone: "invalid" },
          "PATCH",
        )
      ).status,
      400,
    );
    const response = await fetch(f.base + "/api/public");
    assert.equal(
      response.headers.get("cross-origin-opener-policy"),
      "same-origin-allow-popups",
    );
    assert.match(
      response.headers.get("content-security-policy"),
      /apis\.google\.com/,
    );
    assert.doesNotMatch(
      response.headers.get("content-security-policy"),
      /recaptcha/,
    );
  } finally {
    await f.close();
  }
});

test("live sample catalog drafts require Owner scope approval before publication", async () => {
  const f = await fixture(true);
  try {
    const car = await f.store.get("services", "car-cleaning");
    await f.store.transaction(async (tx) =>
      tx.put("services", {
        ...car,
        active: true,
        sample: true,
        sampleReviewed: false,
      }),
    );
    const catalog = await fetch(f.base + "/api/catalog").then((r) => r.json());
    assert.equal(
      catalog.services.some((s) => s.id === car.id),
      false,
    );
    await assert.rejects(
      f.business.availability(
        { id: "customer-1", role: "customer" },
        car.id,
        "2026-10-07",
      ),
      /Service is unavailable/,
    );
    await f.store.transaction(async (tx) =>
      tx.put("services", {
        ...car,
        active: false,
        sample: true,
        sampleReviewed: false,
      }),
    );
    const input = { ...car, active: true, sampleReviewed: false };
    assert.equal(
      (await f.req("/services/car-cleaning", "customer", input, "PATCH"))
        .status,
      403,
    );
    assert.equal(
      (await f.req("/services/car-cleaning", "owner", input, "PATCH")).data
        .code,
      "SAMPLE_REVIEW_REQUIRED",
    );
    assert.equal((await f.store.get("services", "car-cleaning")).active, false);
    const approved = await f.req(
      "/services/car-cleaning",
      "owner",
      { ...input, active: false, sampleReviewed: true },
      "PATCH",
    );
    assert.equal(approved.status, 200);
    assert.equal(approved.data.sample, false);
    assert.equal(approved.data.reviewedBy, "owner-1");
    assert.equal(
      (
        await f.req(
          "/services/car-cleaning",
          "owner",
          { ...approved.data, active: true },
          "PATCH",
        )
      ).status,
      200,
    );
  } finally {
    await f.close();
  }
});

test("review bookings cannot create live payment orders even after credentials change", async () => {
  const f = await fixture();
  try {
    const created = (
      await f.req("/bookings", "customer", payload("review-live-switch-test"))
    ).data;
    await f.store.transaction(async (tx) =>
      tx.put("bookings", { ...created, reviewOnly: true }),
    );
    f.cfg.paymentEnvironment = "live";
    const response = await f.req(
      "/bookings/" + created.id + "/payment/order",
      "customer",
      {},
    );
    assert.equal(response.status, 409);
    assert.equal(response.data.code, "REVIEW_ONLY");
    assert.equal(
      (await f.store.get("bookings", created.id)).orderId,
      undefined,
    );
  } finally {
    await f.close();
  }
});

test('Razorpay test state and ledger pages expose isolated review earnings only',async()=>{
 const f=await fixture();try{
  await f.store.transaction(async tx=>{
   for(const [kind,amount]of [['wallets',99999],['reviewWallets',800]])tx.put(kind,{id:'pro-2',available:amount,held:0,paid:0});
   for(const [kind,id,amount]of [['ledger','real-credit',99999],['reviewLedger','test-credit',800]])tx.put(kind,{id,professionalId:'pro-2',bookingId:'fixture',gross:1000,commission:1000-amount,amount,type:'credit',createdAt:Date.now()});
  });
  let state=(await f.req('/state','partner')).data;assert.equal(state.wallet.available,800);assert.equal(state.ledger[0].id,'test-credit');
  let rows=(await f.req('/records/ledger','partner')).data.rows;assert.equal(rows.length,1);assert.equal(rows[0].id,'test-credit');
  f.cfg.paymentEnvironment='live';state=(await f.req('/state','partner')).data;assert.equal(state.wallet.available,99999);assert.equal(state.ledger[0].id,'real-credit');
  rows=(await f.req('/records/ledger','partner')).data.rows;assert.equal(rows[0].id,'real-credit');
 }finally{await f.close();}
});
