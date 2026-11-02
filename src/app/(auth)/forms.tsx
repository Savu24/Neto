"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { useT } from "@/i18n/client";
import {
  forgotPasswordAction,
  googleLinkAction,
  loginAction,
  registerAction,
  resetPasswordAction,
  twoFactorAction,
  verifyEmailAction,
} from "./actions";

export function LoginForm({ next }: { next: string }) {
  const t = useT("auth");
  const [state, action] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label={t("email")} name="email" type="email" autoComplete="email" required />
      <Field label={t("password")} name="password" type="password" autoComplete="current-password" required />
      <FormMessage state={state} />
      <SubmitButton>{t("signIn")}</SubmitButton>
      <Link href="/forgot-password" className="text-sm">
        {t("forgot")}
      </Link>
    </form>
  );
}

export function TwoFactorForm({ next }: { next: string }) {
  const t = useT("auth");
  const [state, action] = useActionState(twoFactorAction, undefined);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      <Field
        label={t("twoFactorCode")}
        name="code"
        inputMode="text"
        autoComplete="one-time-code"
        autoFocus
        required
        maxLength={12}
      />
      <FormMessage state={state} />
      <SubmitButton>{t("twoFactorSubmit")}</SubmitButton>
    </form>
  );
}

export function RegisterForm({ botSiteKey }: { botSiteKey: string | null }) {
  const t = useT("auth");
  const [state, action] = useActionState(registerAction, undefined);
  return (
    <form action={action} className="grid gap-4">
      <Field label={t("email")} name="email" type="email" autoComplete="email" required />
      <Field
        label={t("password")}
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={12}
        hint={t("passwordHint")}
        required
      />
      <Field label={t("name")} name="name" autoComplete="given-name" />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="acceptTerms" required className="mt-1 size-4" />
        <span>
          {t("acceptTerms", { terms: "§", privacy: "¶" })
            .split(/(§|¶)/)
            .map((part, i) =>
              part === "§" ? (
                <Link key={i} href="/legal/terms" target="_blank">
                  {t("termsLink")}
                </Link>
              ) : part === "¶" ? (
                <Link key={i} href="/legal/privacy" target="_blank">
                  {t("privacyLink")}
                </Link>
              ) : (
                part
              ),
            )}
        </span>
      </label>
      {botSiteKey ? <div className="cf-turnstile" data-sitekey={botSiteKey} /> : null}
      <FormMessage state={state} />
      <SubmitButton>{t("signUp")}</SubmitButton>
    </form>
  );
}

export function ForgotForm() {
  const t = useT("auth");
  const [state, action] = useActionState(forgotPasswordAction, undefined);
  return (
    <form action={action} className="grid gap-4">
      <Field label={t("email")} name="email" type="email" autoComplete="email" required />
      <FormMessage state={state} />
      <SubmitButton>{t("forgotSubmit")}</SubmitButton>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const t = useT("auth");
  const [state, action] = useActionState(resetPasswordAction, undefined);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="token" value={token} />
      <Field
        label={t("newPassword")}
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={12}
        hint={t("passwordHint")}
        required
      />
      <FormMessage state={state} />
      <SubmitButton>{t("resetSubmit")}</SubmitButton>
    </form>
  );
}

/** Potwierdzenie przyciskiem (POST), żeby skanery linków w poczcie nie zużywały tokenu. */
export function VerifyEmailForm({ token, label }: { token: string; label: string }) {
  const [state, action] = useActionState(verifyEmailAction, undefined);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      {state ? null : <SubmitButton>{label}</SubmitButton>}
    </form>
  );
}

export function GoogleLinkForm() {
  const t = useT("auth");
  const [state, action] = useActionState(googleLinkAction, undefined);
  return (
    <form action={action} className="grid gap-4">
      <Field label={t("password")} name="password" type="password" autoComplete="current-password" required />
      <FormMessage state={state} />
      <SubmitButton>{t("googleLinkSubmit")}</SubmitButton>
    </form>
  );
}
