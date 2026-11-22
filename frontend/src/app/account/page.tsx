import { redirect } from "next/navigation";
import LogoutButton from "@/components/logout-button";
import { getCurrentUser } from "@/lib/session";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

export default async function AccountPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?expired=1&next=%2Faccount");
  }

  return (
    <main id="main" className="auth-main">
      <Card className="auth-card account-card">
        <CardHeader>
          <p className="field-help">Your account</p>
          <CardTitle>
            <h1>Welcome, {user.full_name}</h1>
          </CardTitle>
          <CardDescription className="account-email">
            {user.email}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>
            You are logged in. Your saved items and reviews belong to this
            account.
          </p>
          <LogoutButton />
        </CardContent>
      </Card>
    </main>
  );
}
