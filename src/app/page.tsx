import { redirect } from "next/navigation";

// Middleware handles auth: unauthenticated users get bounced to /login.
export default function Home() {
  redirect("/lunch");
}
