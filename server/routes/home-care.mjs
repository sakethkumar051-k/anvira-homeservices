import { homeCare } from "../lib/home-care.mjs";

// Mount after the application's authentication and authenticated rate limits.
export function registerHomeCareRoutes(app, { store, business, cfg }) {
  const care = homeCare(store, business, cfg);
  app.get("/api/home-care", async (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(await care.read(req.user));
  });
  app.put("/api/home-care/favorites/:serviceId", async (req, res) =>
    res.json(await care.favorite(req.user, req.params.serviceId, true)),
  );
  app.delete("/api/home-care/favorites/:serviceId", async (req, res) =>
    res.json(await care.favorite(req.user, req.params.serviceId, false)),
  );
  for (const [kind, create, patch, remove] of [
    ["reminders", care.createReminder, care.patchReminder, care.removeReminder],
    ["assets", care.createAsset, care.patchAsset, care.removeAsset],
  ]) {
    app.post(`/api/home-care/${kind}/:id`, async (req, res) =>
      res.status(201).json(await create(req.user, req.params.id, req.body)),
    );
    app.patch(`/api/home-care/${kind}/:id`, async (req, res) =>
      res.json(await patch(req.user, req.params.id, req.body)),
    );
    app.delete(`/api/home-care/${kind}/:id`, async (req, res) =>
      res.json(await remove(req.user, req.params.id)),
    );
  }
  return care;
}
