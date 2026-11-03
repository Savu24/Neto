"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { scopedDb } from "@/lib/db/scoped";
import { emailAvailable } from "@/lib/email/send";
import { loadPrefs, prefsFromForm, savePrefs } from "@/lib/notifications/prefs";

/** Zapis przełączników (HU-6.3). Formularz działa bez JavaScriptu: po zapisie wracamy z komunikatem. */
export async function saveNotificationPrefsAction(fd: FormData) {
  const { user } = await requireUser();
  const sdb = scopedDb(db(), user.id);
  const rows = prefsFromForm(fd, {
    emailEditable: emailAvailable() && user.emailVerified !== null,
    current: await loadPrefs(sdb),
  });
  await savePrefs(sdb, user.id, rows);
  redirect("/settings/notifications?saved=1");
}
