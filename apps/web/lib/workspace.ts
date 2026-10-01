import { headers } from "next/headers";
import { cache } from "react";
import { auth } from "./auth";

export const getWorkspace = cache(async (slug: string) => {
  try {
    return await auth.api.getFullOrganization({ headers: await headers(), query: { organizationSlug: slug } });
  } catch {
    return null;
  }
});
