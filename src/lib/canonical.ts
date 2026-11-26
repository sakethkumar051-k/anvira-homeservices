/** Points the page's canonical link at a public website path (web only). */
export function setCanonical(path: string) {
  if (typeof document === "undefined") return () => {};
  let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  const created = !link;
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  const previous = link.getAttribute("href");
  link.setAttribute("href", "https://anviraservices.com" + path);
  return () => {
    if (created) link.remove();
    else if (previous) link.setAttribute("href", previous);
  };
}
