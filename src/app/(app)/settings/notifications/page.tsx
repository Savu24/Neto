import type { Metadata } from "next";
import { Notice, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page";
import { getT } from "@/i18n/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { scopedDb } from "@/lib/db/scoped";
import { emailAvailable } from "@/lib/email/send";
import {
  CONFIGURABLE_TYPES,
  EDITABLE_CHANNELS,
  loadPrefs,
  prefField,
  type ConfigurableType,
  type EditableChannel,
} from "@/lib/notifications/prefs";
import { saveNotificationPrefsAction } from "./actions";

export const metadata: Metadata = { title: "Ustawienia powiadomień" };

type T = Awaited<ReturnType<typeof getT<"notifications">>>;

const TYPE_LABELS = {
  WEEKLY_SUMMARY: ["typeWeekly", "typeWeeklyHint"],
  GOAL_ACHIEVED: ["typeGoal", "typeGoalHint"],
  STALE_VALUATION: ["typeStale", "typeStaleHint"],
} as const satisfies Record<ConfigurableType, readonly [string, string]>;

const CHANNEL_LABELS = { IN_APP: "channelInApp", EMAIL: "channelEmail" } as const satisfies Record<
  EditableChannel,
  string
>;

export default async function NotificationPrefsPage({ searchParams }: PageProps<"/settings/notifications">) {
  const { user } = await requireUser();
  const [t, params, prefs] = await Promise.all([
    getT("notifications"),
    searchParams,
    loadPrefs(scopedDb(db(), user.id)),
  ]);
  const emailOn = emailAvailable();
  const emailEditable = emailOn && user.emailVerified !== null;

  return (
    <>
      <PageHeader title={t("prefsTitle")} meta={t("prefsLead")} />
      <div className="grid max-w-[760px] gap-3 pb-2">
        {params.saved ? <Notice>{t("saved")}</Notice> : null}
        {!emailOn ? (
          <p className="text-sm text-ink-2">{t("emailOff")}</p>
        ) : !emailEditable ? (
          <p className="text-sm text-ink-2">{t("emailUnverified")}</p>
        ) : null}
      </div>
      <form action={saveNotificationPrefsAction} className="grid max-w-[760px] gap-4 py-2">
        <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
          <table className="w-full">
            <caption className="sr-only">{t("prefsLegend")}</caption>
            <thead>
              <tr className="border-b border-line text-left text-[13px] text-ink-2">
                <th scope="col" className="px-3.5 py-2.5 font-medium">
                  <span className="sr-only">{t("title")}</span>
                </th>
                {EDITABLE_CHANNELS.map((c) => (
                  <th
                    key={c}
                    scope="col"
                    className="w-[76px] px-2 py-2.5 text-center font-medium sm:w-[110px]"
                  >
                    {t(CHANNEL_LABELS[c])}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CONFIGURABLE_TYPES.map((type) => (
                <tr key={type} className="border-b border-line">
                  <th scope="row" className="px-3.5 py-3 text-left font-normal">
                    <span className="block font-medium">{t(TYPE_LABELS[type][0])}</span>
                    <span className="block text-[13px] text-ink-3">{t(TYPE_LABELS[type][1])}</span>
                  </th>
                  {EDITABLE_CHANNELS.map((channel) => (
                    <td key={channel} className="px-2 py-3 text-center">
                      <Toggle
                        t={t}
                        type={type}
                        channel={channel}
                        checked={channel === "EMAIL" && !emailEditable ? false : prefs(type, channel)}
                        disabled={channel === "EMAIL" && !emailEditable}
                      />
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <th scope="row" className="px-3.5 py-3 text-left font-normal">
                  <span className="block font-medium">{t("typeSecurity")}</span>
                  <span className="block text-[13px] text-ink-3">{t("typeSecurityHint")}</span>
                </th>
                <td className="px-2 py-3 text-center text-ink-3">—</td>
                <td className="px-2 py-3 text-center">
                  <input
                    type="checkbox"
                    checked
                    disabled
                    readOnly
                    aria-label={t("toggleLabel", { type: t("typeSecurity"), channel: t("channelEmail") })}
                    className="size-4 accent-[var(--brand)]"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[13px] text-ink-3">{t("pushNote")}</p>
        <div>
          <SubmitButton>{t("save")}</SubmitButton>
        </div>
      </form>
    </>
  );
}

function Toggle({
  t,
  type,
  channel,
  checked,
  disabled,
}: {
  t: T;
  type: ConfigurableType;
  channel: EditableChannel;
  checked: boolean;
  disabled: boolean;
}) {
  return (
    <input
      type="checkbox"
      name={prefField(type, channel)}
      defaultChecked={checked}
      disabled={disabled}
      aria-label={t("toggleLabel", { type: t(TYPE_LABELS[type][0]), channel: t(CHANNEL_LABELS[channel]) })}
      className="size-4 accent-[var(--brand)] disabled:opacity-50"
    />
  );
}
