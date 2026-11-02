import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ACCOUNTS_ENABLED } from "@/lib/features";
import { TeacherGate, TeacherNav } from "@/components/TeacherGate";
import { TeacherMatrix } from "@/components/TeacherMatrix";

export const metadata: Metadata = { title: "Läraröversikt", robots: { index: false } };

export default function TeacherOverview() {
  if (!ACCOUNTS_ENABLED) notFound();
  return (
    <div className="container-page space-y-6 pt-8">
      <header className="space-y-3">
        <h1>Läraröversikt</h1>
        <TeacherNav current="oversikt" />
      </header>
      <TeacherGate>
        <TeacherMatrix />
      </TeacherGate>
    </div>
  );
}
