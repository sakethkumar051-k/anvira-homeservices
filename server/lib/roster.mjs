// Matching must not silently treat a worker beyond the first page as absent.
export async function approvedRoster(tx, type) {
  const filters = [
    ["approved", "==", true],
    ...(type ? [["type", "==", type]] : []),
  ];
  const profiles = [];
  let cursor;
  do {
    const page = await tx.list("professionals", filters, 200, {
      order: [["id", "asc"]],
      cursor,
    });
    profiles.push(...page);
    if (page.length < 200) break;
    cursor = [page.at(-1).id];
  } while (true);
  return profiles;
}
