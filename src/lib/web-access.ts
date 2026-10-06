export function assertStaffWorkspace(role: string, staffOnly: boolean) {
  if (staffOnly && !["owner", "care"].includes(role))
    throw Object.assign(
      new Error(
        "This portal is for approved Owner and Customer Care staff accounts.",
      ),
      { code: "STAFF_ONLY" },
    );
}
