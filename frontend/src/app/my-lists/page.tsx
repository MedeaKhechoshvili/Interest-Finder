import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

export default async function ListsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?expired=1&next=%2Fmy-lists");
  }

  return (
    <main id="main" className="content-page">
      <h1>My Lists</h1>
      <p>This part of InterestFinder is coming soon.</p>
    </main>
  );
}
