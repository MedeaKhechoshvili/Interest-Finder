import { redirect } from "next/navigation";
import MyListsClient from "@/components/my-lists-client";
import { getCurrentUser } from "@/lib/session";

/** My Lists is private: visitors must sign in before viewing saved items. */
export default async function ListsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?expired=1&next=%2Fmy-lists");

  return (
    <main id="main" className="content-page my-lists-page">
      <MyListsClient />
    </main>
  );
}
