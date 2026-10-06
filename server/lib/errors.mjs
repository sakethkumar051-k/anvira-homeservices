export function fail(status, message, code = "REQUEST_FAILED") {
  throw Object.assign(new Error(message), { status, code });
}
export function assertRole(user, ...roles) {
  if (!roles.includes(user.role))
    fail(403, "This action is not available for your role.", "ROLE_FORBIDDEN");
}
export const clean = (value) => JSON.parse(JSON.stringify(value));
