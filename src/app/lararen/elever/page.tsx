import type { Metadata } from "next";
import { MemberAdmin } from "@/components/MemberAdmin";
import { TeacherGate, TeacherNav } from "@/components/TeacherGate";

export const metadata: Metadata = { title: "Elever", robots: { index: false } };

export default function StudentAdminPage() {
  return (
    <div className="container-page space-y-6 pt-8">
      <header className="space-y-3">
        <h1>Elever</h1>
        <TeacherNav current="elever" />
      </header>
      <TeacherGate>
        <MemberAdmin mode="students" />
      </TeacherGate>
    </div>
  );
}
