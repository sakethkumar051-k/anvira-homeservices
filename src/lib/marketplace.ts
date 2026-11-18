import type { Service } from "./model";
import { serviceCategoryKey, type MainServiceCategory } from "./service-presentation.ts";
export type MarketplaceCategory = MainServiceCategory;
export function categoryForService(
  service: Pick<Service, "id" | "name" | "category">,
): MarketplaceCategory | null {
  const category = serviceCategoryKey(service);
  return category === "other" ? null : category;
}
export function discoverServices(
  services: Service[],
  category = "",
  query = "",
) {
  const search = query.trim().toLocaleLowerCase();
  return services
    .filter((s) => {
      const key = categoryForService(s);
      return (
        s.active &&
        key &&
        (!category || category === key) &&
        (!search ||
          [
            s.name,
            s.nameTe,
            s.category,
            s.description,
            ...(s.packages || []).map((p) => p.name),
          ]
            .join(" ")
            .toLocaleLowerCase()
            .includes(search))
      );
    })
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}
export type ServiceTopic = {
  title: string;
  description: string;
  image: string;
};
export const categoryTopics: Record<MarketplaceCategory, ServiceTopic[]> = {
  home: [
    {
      title: "Full home deep cleaning",
      description:
        "A room-by-room reset for floors, surfaces, kitchen and bathrooms. Tell us your home size and whether it is furnished.",
      image: "cleaning",
    },
    {
      title: "Kitchen cleaning",
      description:
        "Care for greasy surfaces, counters and accessible tiles. Appliance interiors and cabinet interiors are agreed separately.",
      image: "kitchen",
    },
    {
      title: "Bathroom cleaning",
      description:
        "Attention to the basin, WC, accessible fittings and floor. Share any stubborn stains when choosing your scope.",
      image: "bathroom",
    },
    {
      title: "Sofa & upholstery care",
      description:
        "Fabric-aware vacuuming and cleaning. Seat count, material and drying time are confirmed before the visit.",
      image: "sofa",
    },
  ],
  car: [
    {
      title: "Exterior wash",
      description:
        "A doorstep refresh for the body, glass and wheels. Share your vehicle size and available water access.",
      image: "car",
    },
    {
      title: "Inside & out",
      description:
        "Exterior cleaning with interior vacuuming and a dashboard wipe. Choose the scope that fits your vehicle.",
      image: "car",
    },
    {
      title: "Interior detailing",
      description:
        "A closer clean for seats, mats and cabin surfaces. The method depends on upholstery and the condition of the car.",
      image: "car",
    },
  ],
  ac: [
    {
      title: "AC deep cleaning",
      description:
        "Indoor-unit cleaning for dust build-up. Confirm split or window AC and how many units need attention.",
      image: "ac",
    },
    {
      title: "Cooling & repair diagnosis",
      description:
        "A technician checks the issue and explains the repair. Parts and refrigerant need your approval before work.",
      image: "ac",
    },
    {
      title: "Installation & removal",
      description:
        "Help with moving or fitting an AC. Mounts, pipe length and safe access determine the final scope.",
      image: "ac",
    },
  ],
  ro: [
    {
      title: "Purifier service",
      description:
        "Checks for flow, leaks and the condition of your purifier. Share your brand and model before the visit.",
      image: "ro",
    },
    {
      title: "Filter replacement",
      description:
        "Compatible cartridge and membrane replacement. Filters and parts are quoted separately from service labour.",
      image: "ro",
    },
    {
      title: "Installation & removal",
      description:
        "Fit or relocate your water purifier with checks for water access, connections and mounting.",
      image: "ro",
    },
  ],
  plumbing: [
    {
      title: "Tap & fitting repairs",
      description:
        "Care for leaky taps, mixers and accessible connections. Replacement fittings are agreed before installation.",
      image: "plumbing",
    },
    {
      title: "Sink & drain care",
      description:
        "Diagnosis and clearing of accessible blockages. Concealed pipes and major work need a separate scope.",
      image: "plumbing",
    },
    {
      title: "Plumbing inspection",
      description:
        "Not sure where a leak starts? Describe the symptoms and let the office arrange a suitable visit.",
      image: "plumbing",
    },
  ],
  electrical: [
    {
      title: "Switches & sockets",
      description:
        "Repair or replacement of household switches and sockets. Materials are quoted before the work starts.",
      image: "electrical",
    },
    {
      title: "Fans & lighting",
      description:
        "Fitting and repair for ceiling fans and lights. Share the fitting type, access and number of points.",
      image: "electrical",
    },
    {
      title: "Fault diagnosis",
      description:
        "Help identifying household electrical issues. The technician explains the required work before proceeding.",
      image: "electrical",
    },
  ],
};
export function topicPhoto(image: string) {
  return "/images/" + image + ".jpg";
}
export function checkoutPackageChoice(
  available: string[],
  requested?: string,
  saved?: string,
) {
  return requested && available.includes(requested)
    ? requested
    : saved && available.includes(saved)
      ? saved
      : "";
}
