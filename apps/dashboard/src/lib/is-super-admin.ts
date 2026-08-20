export function isSuperAdminRole(roles?: string[] | null) {
  if (!roles?.length) return false;

  return roles.some((role) => role.trim().toLowerCase().replace(/[\s-]+/g, "_") === "super_admin");
}
