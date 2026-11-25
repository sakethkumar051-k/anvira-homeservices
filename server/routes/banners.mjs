import { randomUUID } from "node:crypto";
import { z } from "zod";
import { assertRole, fail } from "../lib/errors.mjs";
import { validProfilePhoto } from "../lib/profile-photo.mjs";
import { serviceSchema } from "../lib/schemas.mjs";

const bannerInput = z
  .object({
    id: z.string().uuid().optional(),
    revision: z.number().int().positive().optional(),
    title: z.string().trim().min(2).max(60),
    subtitle: z.string().trim().max(110).default(""),
    serviceId: z.string().regex(/^[\w-]{1,120}$/),
    order: z.number().int().min(0).max(999),
    startsOn: z.union([z.literal(""), z.iso.date()]),
    endsOn: z.union([z.literal(""), z.iso.date()]),
    active: z.boolean(),
    photo: z
      .string()
      .max(44000)
      .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/)
      .optional(),
  })
  .refine((v) => !v.startsOn || !v.endsOn || v.startsOn <= v.endsOn, {
    message: "End date must be on or after the start date.",
    path: ["endsOn"],
  });

export function currentBanners(rows, services, now = Date.now()) {
  const day = new Date(now + 19800000).toISOString().slice(0, 10);
  const ids = new Set(services.filter((s) => s.active).map((s) => s.id));
  return rows
    .filter(
      (b) =>
        b.active &&
        ids.has(b.serviceId) &&
        (!b.startsOn || b.startsOn <= day) &&
        (!b.endsOn || day <= b.endsOn),
    )
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}
export function publicBannerPhotos(app, { store, cfg }) {
  app.get("/api/banners/:id/photo", async (req, res) => {
    const { id } = req.params;
    if (!z.string().uuid().safeParse(id).success)
      fail(404, "Photo unavailable.");
    const list = await store.get("settings", "banners");
    const banner = list?.rows.find((b) => b.id === id && b.hasPhoto);
    const service = banner && (await store.get("services", banner.serviceId));
    if (
      !service ||
      (cfg.live && service.sample && !service.sampleReviewed) ||
      !serviceSchema.safeParse(service).success ||
      !currentBanners([banner], [service]).length
    )
      fail(404, "Photo unavailable.");
    const photo = await store.get("bannerPhotos", id);
    if (!photo) fail(404, "Photo unavailable.");
    res
      .set("Cross-Origin-Resource-Policy", "cross-origin")
      .type("jpeg")
      .send(Buffer.from(photo.base64, "base64"));
  });
}
export function ownerBannerRoutes(app, { store, business, cfg }) {
  app.put("/api/banners", async (req, res) => {
    assertRole(req.user, "owner");
    const {
      photo,
      id = randomUUID(),
      revision,
      ...fields
    } = bannerInput.parse(req.body);
    const base64 = photo?.split(",")[1];
    if (base64 && !validProfilePhoto(Buffer.from(base64, "base64")))
      fail(400, "Choose a JPEG up to 512 pixels wide and 32 KB.");
    const saved = await store.transaction(async (tx) => {
      const doc = (await tx.get("settings", "banners")) || {
        id: "banners",
        rows: [],
      };
      const previous = doc.rows.find((b) => b.id === id);
      if (revision !== previous?.revision)
        fail(409, "This banner has changed. Reopen it before saving.");
      if (!previous && doc.rows.length >= 24)
        fail(409, "Edit an existing banner. The catalog supports 24 banners.");
      const service = await tx.get("services", fields.serviceId);
      if (
        !service ||
        (fields.active &&
          (!service.active ||
            !serviceSchema.safeParse(service).success ||
            (cfg.live && service.sample && !service.sampleReviewed)))
      )
        fail(400, "Choose a published service before activating this banner.");
      const row = {
        ...fields,
        id,
        revision: (revision || 0) + 1,
        hasPhoto: !!base64 || !!previous?.hasPhoto,
      };
      if (base64) tx.put("bannerPhotos", { id, base64 });
      tx.put("settings", {
        ...doc,
        rows: [...doc.rows.filter((b) => b.id !== id), row],
      });
      business.audit(tx, req.user, "banner_saved", id);
      return row;
    });
    res.json(saved);
  });
}
