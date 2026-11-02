import { schema, type Tx, type Db } from "../db";

export type AuditAction =
  | "student.create"
  | "student.reset-code"
  | "student.delete"
  | "student.export"
  | "user.deactivate"
  | "user.reactivate"
  | "user.role-change"
  | "teacher.invite"
  | "teacher.activate"
  | "operator.bootstrap-teacher"
  | "operator.reset-2fa"
  | "operator.reset-password"
  | "progress.import-legacy";

/** Loggar endast händelsetyp, vem som utförde den och pseudonymt mål-ID. Aldrig namn, koder eller tokens. */
export async function audit(
  conn: Tx | Db,
  entry: { actorId: string | null; groupId: string | null; action: AuditAction; targetUserId?: string | null; details?: Record<string, string | number | boolean | null> },
): Promise<void> {
  await conn.insert(schema.auditLog).values({
    actorId: entry.actorId,
    groupId: entry.groupId,
    action: entry.action,
    targetUserId: entry.targetUserId ?? null,
    details: entry.details ?? null,
  });
}
