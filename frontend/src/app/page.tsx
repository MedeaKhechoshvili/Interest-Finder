import { redirect } from "next/navigation";

// the home page will be added by its feature owner
export default function HomePage() {
  redirect("/login");
}
