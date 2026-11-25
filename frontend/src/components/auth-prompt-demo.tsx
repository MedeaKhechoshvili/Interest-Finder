"use client";

import { useState } from "react";
import { useAuthPrompt } from "@/components/auth-prompt";
import { Button } from "@/components/ui/button";

export default function AuthPromptDemo() {
  const { requireAuth } = useAuthPrompt();
  const [message, setMessage] = useState("");

  function tryPrivateAction() {
    // stop here for guests and let the shared prompt handle login
    if (!requireAuth("/auth-prompt-demo?returned=1")) {
      return;
    }

    setMessage("You are logged in. The private action can continue.");
  }

  return (
    <main id="main" className="content-page">
      <h1>Test login prompt</h1>
      <p>This development page demonstrates a guest trying a private action.</p>
      <Button onClick={tryPrivateAction}>Try private action</Button>
      <p role="status">{message}</p>
    </main>
  );
}
