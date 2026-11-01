import { authenticate } from "@/server/authz";
import { json, route } from "@/server/http";

export const dynamic = "force-dynamic";

/** Vem är inloggad? Svaret är personligt och cachas aldrig. */
export const GET = route(async (request) => {
  const p = await authenticate(request);
  if (!p) return json({ user: null });
  return json({
    user: {
      id: p.userId,
      displayName: p.displayName,
      role: p.role,
      groupName: p.groupName,
      twoFactorEnabled: p.twoFactorEnabled,
      // Lärare utan registrerad tvåfaktor får ingen administratörsåtkomst.
      adminAccess: p.role === "teacher" && p.twoFactorEnabled,
      enrollmentRequired: p.role === "teacher" && !p.twoFactorEnabled,
    },
  });
});
