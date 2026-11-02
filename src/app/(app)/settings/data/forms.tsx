"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { useT } from "@/i18n/client";
import { deleteAccountAction } from "./actions";

export function DeleteAccountForm() {
  const t = useT("settings");
  const [state, action] = useActionState(deleteAccountAction, undefined);
  return (
    <form action={action} className="grid gap-3">
      <Field
        label={t("deleteConfirmLabel")}
        name="confirm"
        type="password"
        autoComplete="current-password"
        required
      />
      <FormMessage state={state} />
      <SubmitButton variant="danger" className="justify-self-start">
        {t("deleteAction")}
      </SubmitButton>
    </form>
  );
}
