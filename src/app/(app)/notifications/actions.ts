"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { scopedDb } from "@/lib/db/scoped";
import { markAllRead, markRead } from "@/lib/notifications/service";

function refresh() {
  revalidatePath("/notifications");
  revalidatePath("/settings");
}

export async function markReadAction(fd: FormData) {
  const { user } = await requireUser();
  const id = fd.get("id");
  if (typeof id === "string" && id) await markRead(scopedDb(db(), user.id), id);
  refresh();
}

export async function markAllReadAction() {
  const { user } = await requireUser();
  await markAllRead(scopedDb(db(), user.id));
  refresh();
}
