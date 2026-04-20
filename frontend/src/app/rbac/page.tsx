import { redirect } from "next/navigation";

export default function LegacyRbacPage() {
  redirect("/user-management?tab=rbac");
}
