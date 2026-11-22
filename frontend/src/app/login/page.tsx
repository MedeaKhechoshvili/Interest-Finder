import { redirect } from "next/navigation";
import LoginForm from "@/components/login-form";
import { getCurrentUser } from "@/lib/session";
import { getReturnPath } from "@/lib/return-path";

interface LoginPageProps {
  searchParams: Promise<{
    next?: string;
    registered?: string;
    expired?: string;
  }>;
}

export default async function LoginPage(props: LoginPageProps) {
  const params = await props.searchParams;
  const next = getReturnPath(params.next);
  const user = await getCurrentUser();

  if (user) {
    redirect(next);
  }

  const registered = params.registered === "1";
  const expired = params.expired === "1";

  return (
    <main id="main" className="auth-main">
      <LoginForm next={next} registered={registered} expired={expired} />
    </main>
  );
}
