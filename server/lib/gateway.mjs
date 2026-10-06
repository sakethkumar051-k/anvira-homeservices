import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { fail } from "./errors.mjs";
export function validSignature(body, signature, secret) {
  if (
    typeof signature !== "string" ||
    !/^[a-f0-9]{64}$/i.test(signature) ||
    !secret
  )
    return false;
  const expected = createHmac("sha256", secret).update(body).digest();
  return timingSafeEqual(Buffer.from(signature, "hex"), expected);
}
export function createGateway(cfg, transport = fetch) {
  async function request(
    path,
    body,
    method = body ? "POST" : "GET",
    key,
    x = false,
  ) {
    const keyId = x
        ? cfg.razorpayXKeyId || cfg.razorpayKeyId
        : cfg.razorpayKeyId,
      keySecret = x
        ? cfg.razorpayXKeySecret || cfg.razorpayKeySecret
        : cfg.razorpayKeySecret;
    if (!keyId || !keySecret)
      fail(
        503,
        "Payments are awaiting account configuration.",
        "PAYMENT_NOT_CONFIGURED",
      );
    let response, data;
    try {
      response = await transport("https://api.razorpay.com/v1/" + path, {
        method,
        headers: {
          Authorization:
            "Basic " + Buffer.from(keyId + ":" + keySecret).toString("base64"),
          "Content-Type": "application/json",
          ...(key ? { "X-Payout-Idempotency": key } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15000),
      });
      data = await response.json();
    } catch {
      fail(
        503,
        "The payment provider is temporarily unavailable. Check your booking before retrying.",
        "GATEWAY_UNAVAILABLE",
      );
    }
    if (!response.ok)
      fail(
        502,
        "The payment provider could not complete this request.",
        "GATEWAY_FAILED",
      );
    return data;
  }
  return {
    mode: cfg.paymentMode,
    async order(booking) {
      if (cfg.paymentMode === "demo")
        return {
          id: "demo_order_" + booking.id,
          amount: booking.total * 100,
          currency: "INR",
        };
      return request("orders", {
        amount: booking.total * 100,
        currency: "INR",
        receipt: booking.id,
        notes: { bookingId: booking.id },
      });
    },
    async payment(id) {
      if (!/^pay_[A-Za-z0-9]+$/.test(id))
        fail(400, "Invalid payment identifier.");
      return request("payments/" + id);
    },
    async refund(booking, key) {
      if (cfg.paymentMode === "demo")
        return { id: "demo_refund_" + booking.id, status: "processed" };
      return request("payments/" + booking.paymentId + "/refund", {
        amount: booking.total * 100,
        receipt: key.slice(0, 40),
        notes: { bookingId: booking.id },
      });
    },
    async orderStatus(id) {
      return request("orders/" + id);
    },
    async payoutStatus(id) {
      return request("payouts/" + id, undefined, "GET", undefined, true);
    },
    async refundStatus(id) {
      return request("refunds/" + id);
    },
    async fundAccount(user, details) {
      if (cfg.paymentMode === "demo")
        return {
          contactId: "demo_contact_" + user.id,
          fundAccountId: "demo_fund_" + user.id,
          last4: details.accountNumber.slice(-4),
        };
      if (!cfg.payoutsEnabled)
        fail(503, "Partner payouts are awaiting configuration.");
      const contact = await request(
        "contacts",
        {
          name: details.name,
          type: "vendor",
          reference_id: user.id,
          email: details.email || undefined,
        },
        "POST",
        undefined,
        true,
      );
      const fund = await request(
        "fund_accounts",
        {
          contact_id: contact.id,
          account_type: "bank_account",
          bank_account: {
            name: details.name,
            ifsc: details.ifsc,
            account_number: details.accountNumber,
          },
        },
        "POST",
        undefined,
        true,
      );
      return {
        contactId: contact.id,
        fundAccountId: fund.id,
        last4: details.accountNumber.slice(-4),
      };
    },
    async payout(payout, professional) {
      if (cfg.paymentMode === "demo")
        return { id: "demo_payout_" + payout.id, status: "processed" };
      if (
        !cfg.payoutsEnabled ||
        !cfg.payoutAccount ||
        !professional.fundAccountId
      )
        fail(503, "Partner bank account or payout account is not configured.");
      return request(
        "payouts",
        {
          account_number: cfg.payoutAccount,
          fund_account_id: professional.fundAccountId,
          amount: payout.amount * 100,
          currency: "INR",
          mode: "IMPS",
          purpose: "payout",
          queue_if_low_balance: true,
          reference_id: payout.id.slice(0, 40),
          narration: "ANVIRA partner services",
        },
        "POST",
        payout.id,
        true,
      );
    },
    signature: validSignature,
  };
}
