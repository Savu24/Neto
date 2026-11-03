import type { Metadata } from "next";
import { PageHeader } from "@/components/page";
import { getLocale, getT } from "@/i18n/server";
import { describeDevice } from "@/lib/auth/service";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { scopedDb } from "@/lib/db/scoped";
import { emailAvailable } from "@/lib/email/send";
import { formatDate } from "@/lib/format";
import { logoutAllAction, revokeSessionAction } from "./actions";
import {
  ChangePasswordForm,
  DisableTwoFactorForm,
  EnableTwoFactor,
  RegenerateCodesForm,
  ResendVerificationButton,
} from "./forms";

export const metadata: Metadata = { title: "Bezpieczeństwo" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3 border-t border-line py-5 first-of-type:border-t-0">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default async function SecurityPage() {
  const { user, session: current } = await requireUser();
  const sdb = scopedDb(db(), user.id);
  const [t, locale, full, sessions, unusedCodes, google] = await Promise.all([
    getT("settings"),
    getLocale(),
    sdb.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } }),
    sdb.session.findMany({ orderBy: { lastSeenAt: "desc" } }),
    sdb.backupCode.count({ where: { usedAt: null } }),
    sdb.account.count({ where: { provider: "google" } }),
  ]);

  return (
    <>
      <PageHeader title={t("security")} meta={t("securityLead")} />

      <Section title={t("emailStatus")}>
        <p>
          {user.email}:{" "}
          <span className="text-ink-2">
            {user.emailVerified ? t("emailVerified") : t("emailNotVerified")}
          </span>
        </p>
        {!user.emailVerified && emailAvailable() ? <ResendVerificationButton /> : null}
      </Section>

      <Section title={t("changePassword")}>
        <ChangePasswordForm hasPassword={Boolean(full.passwordHash)} />
      </Section>

      <Section title={t("twoFactor")}>
        <p className="text-ink-2">{user.totpEnabledAt ? t("twoFactorOn") : t("twoFactorOff")}</p>
        {user.totpEnabledAt ? (
          <>
            <p className="text-sm text-ink-2">{t("backupCodesRemaining", { count: unusedCodes })}</p>
            <RegenerateCodesForm />
            <DisableTwoFactorForm />
          </>
        ) : (
          <EnableTwoFactor />
        )}
      </Section>

      <Section title={t("googleLinked")}>
        <p className="text-ink-2">{google > 0 ? t("googleConnected") : t("googleNotConnected")}</p>
      </Section>

      <Section title={t("sessions")}>
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface px-3.5 shadow-card">
          {sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span>
                <span className="font-medium">{describeDevice(s.userAgent)}</span>
                {s.id === current.id ? (
                  <span className="ml-2 text-sm text-brand">{t("sessionCurrent")}</span>
                ) : null}
                <br />
                <span className="text-[13px] text-ink-3">
                  {t("sessionLastSeen", { date: formatDate(s.lastSeenAt, locale) })}
                  {s.ipPrefix ? `, ${s.ipPrefix}` : ""}
                </span>
              </span>
              {s.id !== current.id ? (
                <form action={revokeSessionAction}>
                  <input type="hidden" name="sessionId" value={s.id} />
                  <button type="submit" className="text-sm font-semibold text-down">
                    {t("sessionRevoke")}
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        {sessions.length > 1 ? (
          <form action={logoutAllAction}>
            <button
              type="submit"
              className="h-11 rounded-[10px] border border-line-strong bg-surface px-4 font-semibold text-ink shadow-card transition-colors hover:bg-surface-2"
            >
              {t("logoutAll")}
            </button>
          </form>
        ) : null}
      </Section>
    </>
  );
}
