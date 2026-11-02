import type { Metadata } from "next";
import { MemberAdmin } from "@/components/MemberAdmin";
import { TeacherGate, TeacherNav } from "@/components/TeacherGate";

export const metadata: Metadata = { title: "Lärare", robots: { index: false } };

export default function TeacherAdminPage() {
  return (
    <div className="container-page space-y-6 pt-8">
      <header className="space-y-3">
        <h1>Lärare</h1>
        <TeacherNav current="larare" />
      </header>
      <TeacherGate>
        <MemberAdmin mode="teachers" />
      </TeacherGate>
    </div>
  );
}
