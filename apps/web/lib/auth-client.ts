import { magicLinkClient, organizationClient, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { ac, roles } from "./permissions";

export const authClient = createAuthClient({
  plugins: [magicLinkClient(), organizationClient({ ac, roles }), twoFactorClient()],
});
