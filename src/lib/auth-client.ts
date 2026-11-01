"use client";

import { createAuthClient } from "better-auth/react";
import { twoFactorClient, usernameClient } from "better-auth/client/plugins";

/** Klient för Better Auth (samma ursprung, /api/auth). Sessionen ligger i en HttpOnly-cookie; ingen token i localStorage. */
export const authClient = createAuthClient({
  plugins: [usernameClient(), twoFactorClient()],
});
