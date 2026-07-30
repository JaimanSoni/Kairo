import { redirect } from "next/navigation";

/** The overview moved to /admin when the dashboard became five pages. */
export default function AdminDashboardRedirect() {
  redirect("/admin");
}
