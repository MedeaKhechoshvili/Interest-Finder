import { redirect } from "next/navigation";
import RegisterForm from "@/components/register-form";
import { getCurrentUser } from "@/lib/session";
import { getReturnPath } from "@/lib/return-path";

interface RegisterPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function RegisterPage(props: RegisterPageProps) {
  const params = await props.searchParams;
  const next = getReturnPath(params.next);
  const user = await getCurrentUser();

  if (user) {
    redirect(next);
  }

  return (
    <main id="main" className="auth-main">
      <RegisterForm next={next} />
    </main>
  );
}
