import type { Metadata } from "next";
import Link from "next/link";
import { SubmitButton } from "@/components/form";
import { Disclaimer, EmptyState, PageHeader } from "@/components/page";
import { getLocale, getT } from "@/i18n/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { scopedDb } from "@/lib/db/scoped";
import { formatDate } from "@/lib/format";
import { parsePayload, renderNotification } from "@/lib/notifications/content";
import { listNotifications } from "@/lib/notifications/service";
import { Tag } from "../assets/ui";
import { markAllReadAction, markReadAction } from "./actions";

export const metadata: Metadata = { title: "Powiadomienia" };

export default async function NotificationsPage() {
  const { user } = await requireUser();
  const [t, tc, locale] = await Promise.all([getT("notifications"), getT("common"), getLocale()]);
  const items = await listNotifications(scopedDb(db(), user.id));
  const unread = items.filter((n) => n.readAt === null).length;

  return (
    <>
      <PageHeader
        title={t("title")}
        meta={
          items.length === 0 ? undefined : unread > 0 ? t("metaUnread", { count: unread }) : t("metaAllRead")
        }
        actions={
          unread > 0 ? (
            <form action={markAllReadAction}>
              <SubmitButton variant="secondary">{t("markAllRead")}</SubmitButton>
            </form>
          ) : undefined
        }
      />
      {items.length === 0 ? (
        <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
      ) : (
        <ul className="mt-2 grid max-w-[760px] gap-3">
          {items.map((n) => {
            const payload = parsePayload(n.data);
            const { title, body } = payload ? renderNotification(locale, payload) : n;
            const isUnread = n.readAt === null;
            return (
              <li
                key={n.id}
                data-testid="notification"
                data-unread={isUnread || undefined}
                className={`rounded-xl border bg-surface px-4 py-3.5 shadow-card ${
                  isUnread ? "border-brand/30" : "border-line"
                }`}
              >
                <article className="grid gap-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h2 className="flex items-center gap-2 font-semibold">
                      {title}
                      {isUnread ? <Tag>{t("unread")}</Tag> : null}
                    </h2>
                    <time dateTime={n.createdAt.toISOString()} className="text-[13px] text-ink-3">
                      {formatDate(n.createdAt, locale, "long")}
                    </time>
                  </div>
                  <p className="text-ink-2">{body}</p>
                  {isUnread ? (
                    <form action={markReadAction} className="mt-1.5">
                      <input type="hidden" name="id" value={n.id} />
                      <button
                        type="submit"
                        aria-label={t("markReadLabel", { title })}
                        className="text-sm font-medium text-brand hover:text-brand-strong"
                      >
                        {t("markRead")}
                      </button>
                    </form>
                  ) : null}
                </article>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-6">
        <Link href="/settings/notifications" className="font-medium text-brand hover:text-brand-strong">
          {t("preferences")}
        </Link>
      </p>
      <Disclaimer>{tc("disclaimerResults")}</Disclaimer>
    </>
  );
}
