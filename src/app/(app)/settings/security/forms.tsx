"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { useT } from "@/i18n/client";
import {
  changePasswordAction,
  confirmTotpAction,
  disableTotpAction,
  regenerateCodesAction,
  resendVerificationAction,
  startTotpAction,
  type TotpSetupState,
} from "./actions";

export function ChangePasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const t = useT("settings");
  const [state, action] = useActionState(changePasswordAction, undefined);
  return (
    <form action={action} className="grid gap-3">
      {hasPassword ? (
        <Field
          label={t("currentPassword")}
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      ) : null}
      <Field
        label={t("changePassword")}
        name="newPassword"
        type="password"
        autoComplete="new-password"
        minLength={12}
        required
      />
      <FormMessage state={state} />
      <SubmitButton variant="secondary" className="justify-self-start">
        {t("changePassword")}
      </SubmitButton>
    </form>
  );
}

function BackupCodes({ codes }: { codes: string[] }) {
  const t = useT("settings");
  const router = useRouter();
  return (
    <div className="grid gap-2 rounded-xl border border-line bg-surface p-4 shadow-card">
      <h3 className="font-semibold">{t("backupCodesTitle")}</h3>
      <p className="text-sm text-ink-2">{t("backupCodesLead")}</p>
      <ul className="grid grid-cols-2 gap-1 font-mono text-[15px]" aria-label={t("backupCodesTitle")}>
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => router.refresh()}
        className="h-11 justify-self-start rounded-[10px] border border-line px-4 font-semibold text-brand"
      >
        {t("backupCodesDone")}
      </button>
    </div>
  );
}

export function EnableTwoFactor() {
  const t = useT("settings");
  const [setup, setSetup] = useState<TotpSetupState | null>(null);
  const [pending, startTransition] = useTransition();
  const [state, action] = useActionState(confirmTotpAction, {} as TotpSetupState);
  const current = state.backupCodes ? state : (setup ?? {});

  if (state.backupCodes) return <BackupCodes codes={state.backupCodes} />;
  if (!current.secret) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => setSetup(await startTotpAction()))}
        className="h-11 justify-self-start rounded-[10px] bg-brand px-4 font-semibold text-on-brand disabled:opacity-60"
      >
        {t("twoFactorEnable")}
      </button>
    );
  }
  return (
    <div className="grid gap-3">
      <p className="text-sm text-ink-2">{t("twoFactorSetupLead")}</p>
      {/* SVG z biblioteki qrcode generowany na serwerze z naszego sekretu, bez danych od użytkownika. */}
      <div
        className="size-[200px] rounded-lg bg-white p-1"
        role="img"
        aria-label="QR"
        dangerouslySetInnerHTML={{ __html: current.qrSvg ?? "" }}
      />
      <p className="text-sm">
        {t("twoFactorSecretLabel")}:{" "}
        <code className="font-mono break-all" data-testid="totp-secret">
          {current.secret}
        </code>
      </p>
      <form action={action} className="grid gap-3">
        <Field
          label={t("twoFactorConfirm")}
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
        />
        <FormMessage state={state.error ? { error: state.error } : undefined} />
        <SubmitButton className="justify-self-start">{t("twoFactorConfirm")}</SubmitButton>
      </form>
    </div>
  );
}

export function DisableTwoFactorForm() {
  const t = useT("settings");
  const [state, action] = useActionState(disableTotpAction, undefined);
  return (
    <form action={action} className="grid gap-3">
      <Field
        label={t("confirmWithPassword")}
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <FormMessage state={state} />
      <SubmitButton variant="danger" className="justify-self-start">
        {t("twoFactorDisable")}
      </SubmitButton>
    </form>
  );
}

export function RegenerateCodesForm() {
  const t = useT("settings");
  const [state, action] = useActionState(regenerateCodesAction, {});
  if (state.codes) return <BackupCodes codes={state.codes} />;
  return (
    <form action={action} className="grid gap-3">
      <Field
        label={t("confirmWithPassword")}
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <FormMessage state={state.error ? { error: state.error } : undefined} />
      <SubmitButton variant="secondary" className="justify-self-start">
        {t("backupCodesRegenerate")}
      </SubmitButton>
    </form>
  );
}

export function ResendVerificationButton() {
  const t = useT("settings");
  const [state, action] = useActionState(resendVerificationAction, undefined);
  return (
    <form action={action} className="grid gap-2">
      <FormMessage state={state} />
      {state ? null : (
        <SubmitButton variant="secondary" className="justify-self-start">
          {t("emailResend")}
        </SubmitButton>
      )}
    </form>
  );
}
