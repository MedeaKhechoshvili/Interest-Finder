"use client";

import { goToPage } from "@/lib/navigation";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function LogoutButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  let buttonText = "Log Out";
  let errorMessage = null;

  if (loading) {
    buttonText = "Logging out...";
  }

  if (error) {
    errorMessage = (
      <Alert className="form-error" variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  async function handleLogout() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });

      if (!response.ok) {
        setError("Could not log out. Please try again.");
        setLoading(false);
        return;
      }

      // a new page request also clears old account information from the screen
      goToPage("/login");
    } catch {
      setError("Could not connect. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div>
      {errorMessage}
      <Button
        variant="outline"
        type="button"
        className="secondary-button"
        onClick={handleLogout}
        disabled={loading}
      >
        {buttonText}
      </Button>
    </div>
  );
}
