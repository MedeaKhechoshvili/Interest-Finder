import { notFound } from "next/navigation";
import AuthPromptDemo from "@/components/auth-prompt-demo";

export default function AuthPromptDemoPage() {
  // keep the test page out of the production app
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <AuthPromptDemo />;
}
