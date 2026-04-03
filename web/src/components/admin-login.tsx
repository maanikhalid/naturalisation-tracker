"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function AdminLogin() {
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const payload = {
      username: String(form.get("username") ?? ""),
      password: String(form.get("password") ?? ""),
    };

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "Login failed");
      setIsLoading(false);
      return;
    }

    router.refresh();
    setIsLoading(false);
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="govuk-form-group">
        <label className="govuk-label" htmlFor="username">
          Username
        </label>
        <input className="govuk-input" id="username" name="username" required />
      </div>
      <div className="govuk-form-group">
        <label className="govuk-label" htmlFor="password">
          Password
        </label>
        <input className="govuk-input" id="password" name="password" type="password" required />
      </div>
      <button className="govuk-button" disabled={isLoading}>
        {isLoading ? "Signing in..." : "Sign in"}
      </button>
      {error && <p className="govuk-error-message">{error}</p>}
    </form>
  );
}
