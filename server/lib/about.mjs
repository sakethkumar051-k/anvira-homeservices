import { z } from "zod";
export const aboutContentSchema = z
  .object({
    title: z.string().trim().max(120),
    intro: z.string().trim().max(600),
    story: z.string().trim().max(6000),
    mission: z.string().trim().max(1200),
    values: z.string().trim().max(1200),
    serviceArea: z.string().trim().max(300),
  })
  .strict();
export const aboutUpdateSchema = z
  .object({
    action: z.enum(["save", "publish", "unpublish"]),
    revision: z.number().int().nonnegative(),
    content: aboutContentSchema,
  })
  .strict();
export const emptyAbout = () => ({
  id: "about",
  revision: 0,
  draft: {
    title: "",
    intro: "",
    story: "",
    mission: "",
    values: "",
    serviceArea: "",
  },
  published: null,
});
