import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements, memberAc, ownerAc } from "better-auth/plugins/organization/access";

export const ac = createAccessControl(defaultStatements);

export const roles = {
  owner: ac.newRole(ownerAc.statements),
  admin: ac.newRole(adminAc.statements),
  developer: ac.newRole(memberAc.statements),
  viewer: ac.newRole(memberAc.statements),
};

export type Role = keyof typeof roles;

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  developer: "Developer",
  viewer: "Viewer",
};
