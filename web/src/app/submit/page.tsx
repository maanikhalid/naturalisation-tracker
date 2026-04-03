"use client";

import { FormEvent, useState } from "react";

type SubmitState = { ok: boolean; message: string } | null;

export default function SubmitPage() {
  const [state, setState] = useState<SubmitState>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setState(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      username: String(form.get("username") ?? ""),
      applicationMethod: String(form.get("applicationMethod")),
      applicationDate: String(form.get("applicationDate")),
      biometricDate: String(form.get("biometricDate")),
      approvalDate: String(form.get("approvalDate") ?? ""),
      receivedHomeOfficeEmail: Boolean(form.get("receivedHomeOfficeEmail")),
      ceremonyDate: String(form.get("ceremonyDate") ?? ""),
      status: String(form.get("status")),
    };

    const response = await fetch("/api/timeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (!response.ok) {
      setState({ ok: false, message: data.error ?? "Submission failed." });
      setIsLoading(false);
      return;
    }

    setState({ ok: true, message: "Submission saved. Thank you." });
    (event.target as HTMLFormElement).reset();
    setIsLoading(false);
  }

  return (
    <main className="govuk-width-container app-main">
      <h1 className="govuk-heading-l">Submit your Form AN timeline</h1>
      <p className="govuk-body">
        Anonymous by default. Username is optional and helps with update tracking.
      </p>

      <form onSubmit={onSubmit} className="govuk-!-margin-top-6">
        <div className="govuk-form-group">
          <label className="govuk-label" htmlFor="username">
            Optional username
          </label>
          <input className="govuk-input" id="username" name="username" />
        </div>

        <div className="govuk-form-group">
          <label className="govuk-label" htmlFor="applicationMethod">
            Application method
          </label>
          <select className="govuk-select" id="applicationMethod" name="applicationMethod" defaultValue="ONLINE">
            <option value="ONLINE">Online</option>
            <option value="POST">Post</option>
          </select>
        </div>

        <div className="govuk-form-group">
          <label className="govuk-label" htmlFor="applicationDate">
            Application date
          </label>
          <input className="govuk-input" type="date" id="applicationDate" name="applicationDate" required />
        </div>

        <div className="govuk-form-group">
          <label className="govuk-label" htmlFor="biometricDate">
            Biometric date
          </label>
          <input className="govuk-input" type="date" id="biometricDate" name="biometricDate" required />
        </div>

        <div className="govuk-form-group">
          <label className="govuk-label" htmlFor="approvalDate">
            Approval date
          </label>
          <input className="govuk-input" type="date" id="approvalDate" name="approvalDate" />
        </div>

        <div className="govuk-form-group">
          <label className="govuk-label" htmlFor="ceremonyDate">
            Ceremony date
          </label>
          <input className="govuk-input" type="date" id="ceremonyDate" name="ceremonyDate" />
        </div>

        <div className="govuk-form-group">
          <fieldset className="govuk-fieldset">
            <legend className="govuk-fieldset__legend">Received Home Office email?</legend>
            <div className="govuk-checkboxes">
              <div className="govuk-checkboxes__item">
                <input
                  className="govuk-checkboxes__input"
                  id="receivedHomeOfficeEmail"
                  name="receivedHomeOfficeEmail"
                  type="checkbox"
                />
                <label className="govuk-label govuk-checkboxes__label" htmlFor="receivedHomeOfficeEmail">
                  Yes
                </label>
              </div>
            </div>
          </fieldset>
        </div>

        <div className="govuk-form-group">
          <label className="govuk-label" htmlFor="status">
            Current status
          </label>
          <select className="govuk-select" id="status" name="status" defaultValue="SUBMITTED">
            <option value="SUBMITTED">Submitted</option>
            <option value="BIOMETRICS_DONE">Biometrics done</option>
            <option value="EMAIL_RECEIVED">Home Office email received</option>
            <option value="APPROVED">Approved</option>
            <option value="CEREMONY_PENDING">Ceremony pending</option>
            <option value="CEREMONY_DONE">Ceremony done</option>
          </select>
        </div>

        <button disabled={isLoading} className="govuk-button" data-module="govuk-button">
          {isLoading ? "Submitting..." : "Submit timeline"}
        </button>
      </form>

      {state && (
        <p className={state.ok ? "govuk-body success-text" : "govuk-error-message"}>
          {state.message}
        </p>
      )}
    </main>
  );
}
