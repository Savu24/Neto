"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Notice } from "@/components/form";
import type { AccountType } from "@/generated/prisma/enums";
import { useLocale, useT } from "@/i18n/client";
import { formatDate, formatMoney } from "@/lib/format";
import { MAX_FILE_BYTES } from "@/lib/portfolio/import/csv";
import { FIELDS, type Field, type Mapping } from "@/lib/portfolio/import/mapping";
import type { Analysis, ImportResult, Preview, PreviewRow } from "@/lib/portfolio/import/service";
import { holdsInstruments } from "@/lib/portfolio/ledger/types";
import { Select } from "../../assets/account-form";
import { analyzeImportAction, commitImportAction, previewImportAction, revertImportAction } from "./actions";

/** Import CSV w krokach: plik → mapowanie → podgląd → import (HU-2.4). */

type Step = "file" | "mapping" | "preview" | "done";

const CASH_FIELDS: readonly Field[] = ["date", "amount", "description", "type", "currency"];

async function gzip(file: File): Promise<Blob | null> {
  if (typeof CompressionStream === "undefined") return null;
  return new Response(file.stream().pipeThrough(new CompressionStream("gzip"))).blob();
}

export function ImportWizard({
  accounts,
  initialAccountId,
}: {
  accounts: readonly { id: string; name: string; type: AccountType }[];
  initialAccountId?: string;
}) {
  const t = useT("import");
  const tt = useT("transactions");
  const locale = useLocale();
  const router = useRouter();
  const fileId = useId();
  const [step, setStep] = useState<Step>("file");
  const [accountId, setAccountId] = useState(initialAccountId ?? accounts[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [payload, setPayload] = useState<{ blob: Blob; gzip: boolean } | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (accounts.length === 0) return <p className="text-ink-2">{t("noAccounts")}</p>;
  const account = accounts.find((a) => a.id === accountId);
  const fields = account && holdsInstruments(account.type) ? FIELDS : CASH_FIELDS;

  function formData(p = payload, m: Mapping | null = mapping) {
    const fd = new FormData();
    fd.set("accountId", accountId);
    fd.set("fileName", file?.name ?? "plik.csv");
    if (p) {
      fd.set("file", p.blob);
      fd.set("gzip", p.gzip ? "1" : "0");
    }
    if (m) fd.set("mapping", JSON.stringify(m));
    return fd;
  }

  function analyze() {
    setError(null);
    if (!file) return setError(t("err_file"));
    if (file.size > MAX_FILE_BYTES) return setError(t("err_tooLarge"));
    startTransition(async () => {
      const compressed = await gzip(file);
      const p = compressed ? { blob: compressed, gzip: true } : { blob: file, gzip: false };
      setPayload(p);
      const res = await analyzeImportAction(formData(p, null));
      if (!res.ok) return setError(res.error);
      setAnalysis(res.data);
      setMapping(res.data.mapping);
      setStep("mapping");
    });
  }

  function showPreview() {
    setError(null);
    startTransition(async () => {
      const res = await previewImportAction(formData());
      if (!res.ok) return setError(res.error);
      setPreview(res.data);
      setStep("preview");
    });
  }

  function commit() {
    setError(null);
    startTransition(async () => {
      const res = await commitImportAction(formData());
      if (!res.ok) return setError(res.error);
      setResult(res.data);
      setStep("done");
      router.refresh();
    });
  }

  function undo(batchId: string) {
    setError(null);
    startTransition(async () => {
      const res = await revertImportAction(batchId);
      if (!res.ok) return setError(res.error);
      setNotice(t("undone", { count: res.data.count }));
      setResult(null);
      router.refresh();
    });
  }

  const steps: [Step, string][] = [
    ["file", t("step1")],
    ["mapping", t("step2")],
    ["preview", t("step3")],
    ["done", t("step4")],
  ];
  const stepIndex = steps.findIndex(([s]) => s === step);

  return (
    <div className="grid gap-4">
      <ol aria-label={t("steps")} className="flex flex-wrap gap-2 text-[13px]">
        {steps.map(([s, label], i) => (
          <li
            key={s}
            aria-current={s === step ? "step" : undefined}
            className={`rounded-full px-3 py-1 ${i <= stepIndex ? "bg-brand-soft font-semibold text-brand" : "bg-surface text-ink-3"}`}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {error ? (
        <p role="alert" className="rounded-[10px] bg-down-soft px-3 py-2 text-sm text-ink">
          {error}
        </p>
      ) : null}
      {notice ? <Notice>{notice}</Notice> : null}

      {step === "file" ? (
        <div className="grid gap-4 rounded-xl border border-line bg-surface p-4 lg:p-5">
          <Select label={t("account")} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <div className="grid gap-1">
            <label htmlFor={fileId} className="text-sm font-medium">
              {t("file")}
            </label>
            <input
              id={fileId}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              aria-describedby={`${fileId}-hint`}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-[15px] file:mr-3 file:rounded-[10px] file:border file:border-line file:bg-surface file:px-3 file:py-2 file:font-semibold file:text-brand"
            />
            <p id={`${fileId}-hint`} className="text-[13px] text-ink-3">
              {t("fileHint")}
            </p>
          </div>
          <Button onClick={analyze} disabled={pending || !file} primary>
            {t("next")}
          </Button>
        </div>
      ) : null}

      {step === "mapping" && analysis && mapping ? (
        <div className="grid gap-4 rounded-xl border border-line bg-surface p-4 lg:p-5">
          <p className="text-[14px] text-ink-2">
            {t("detected", {
              encoding: analysis.encoding.toUpperCase(),
              delimiter: t(
                `delimiter_${({ ";": "semicolon", ",": "comma", "\t": "tab", "|": "pipe" } as const)[analysis.delimiter]}`,
              ),
              rows: analysis.rowCount,
            })}
          </p>
          {analysis.remembered ? <Notice>{t("remembered")}</Notice> : null}
          <p className="font-medium">{t("mappingLead")}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map((f) => (
              <Select
                key={f}
                label={t(`field_${f}`)}
                value={mapping.columns[f] ?? ""}
                onChange={(e) =>
                  setMapping({
                    ...mapping,
                    columns: { ...mapping.columns, [f]: e.target.value || undefined },
                  })
                }
              >
                <option value="">{t("notMapped")}</option>
                {analysis.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </Select>
            ))}
            <Select
              label={t("dateFormat")}
              value={mapping.dateFormat}
              onChange={(e) =>
                setMapping({ ...mapping, dateFormat: e.target.value as Mapping["dateFormat"] })
              }
            >
              {(["DMY", "YMD", "MDY"] as const).map((d) => (
                <option key={d} value={d}>
                  {t(`df_${d}`)}
                </option>
              ))}
            </Select>
            <Select
              label={t("numberFormat")}
              value={mapping.numberFormat}
              onChange={(e) =>
                setMapping({ ...mapping, numberFormat: e.target.value as Mapping["numberFormat"] })
              }
            >
              {(["comma", "dot"] as const).map((n) => (
                <option key={n} value={n}>
                  {t(`nf_${n}`)}
                </option>
              ))}
            </Select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-left text-[13px]">
              <caption className="mb-1 text-left text-[13px] font-medium text-ink-2">{t("sample")}</caption>
              <thead>
                <tr>
                  {analysis.headers.map((h) => (
                    <th key={h} scope="col" className="border-b border-line px-2 py-1 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {analysis.sample.map((r, i) => (
                  <tr key={i}>
                    {analysis.headers.map((h, j) => (
                      <td key={h} className="border-b border-line px-2 py-1">
                        {r[j]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setStep("file")}>{t("back")}</Button>
            <Button onClick={showPreview} disabled={pending} primary>
              {t("showPreview")}
            </Button>
          </div>
        </div>
      ) : null}

      {step === "preview" && preview ? (
        <div className="grid gap-4 rounded-xl border border-line bg-surface p-4 lg:p-5">
          <p role="status" className="font-medium">
            {t("summary", {
              total: preview.total,
              ok: preview.ok,
              duplicates: preview.duplicates,
              errors: preview.errors,
            })}
          </p>
          <p className="text-[13px] text-ink-3">
            {t("previewNote")}{" "}
            {preview.rows.length < preview.total ? t("previewLimit", { count: preview.rows.length }) : null}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr>
                  <th scope="col" className="border-b border-line px-2 py-1">
                    {t("line")}
                  </th>
                  <th scope="col" className="border-b border-line px-2 py-1">
                    {t("status")}
                  </th>
                  <th scope="col" className="border-b border-line px-2 py-1">
                    {t("details")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.line} data-status={r.status}>
                    <td className="border-b border-line px-2 py-1">{r.line}</td>
                    <td
                      className={`border-b border-line px-2 py-1 ${r.status === "error" ? "text-down" : r.status === "duplicate" ? "text-warn" : "text-up"}`}
                    >
                      {t(`status_${r.status}`)}
                    </td>
                    <td className="border-b border-line px-2 py-1">
                      <RowDetails row={r} t={t} tt={tt} locale={locale} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setStep("mapping")}>{t("back")}</Button>
            <Button onClick={commit} disabled={pending || preview.ok === 0} primary>
              {preview.ok === 0 ? t("nothingToImport") : t("importNow", { count: preview.ok })}
            </Button>
          </div>
        </div>
      ) : null}

      {step === "done" ? (
        <div className="grid gap-3 rounded-xl border border-line bg-surface p-4 lg:p-5">
          {result ? (
            <>
              <p role="status" className="font-medium">
                {t("done", { imported: result.imported, skipped: result.total - result.imported })}
              </p>
              <p className="text-[13px] text-ink-3">{t("undoWindow")}</p>
            </>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/assets/${accountId}`}
              className="inline-flex h-11 items-center rounded-[10px] bg-brand px-4 font-semibold text-on-brand"
            >
              {t("goToAccount")}
            </Link>
            {result ? (
              <Button onClick={() => undo(result.batchId)} disabled={pending}>
                {t("undo")}
              </Button>
            ) : null}
            <Button
              onClick={() => {
                setStep("file");
                setFile(null);
                setPreview(null);
                setResult(null);
                setNotice(null);
              }}
            >
              {t("importAnother")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RowDetails({
  row,
  t,
  tt,
  locale,
}: {
  row: PreviewRow;
  t: ReturnType<typeof useT<"import">>;
  tt: ReturnType<typeof useT<"transactions">>;
  locale: ReturnType<typeof useLocale>;
}) {
  if (row.status === "error" && row.error) return <>{t(`row_${row.error}`, row.params)}</>;
  const parts = [
    row.date ? formatDate(`${row.date}T12:00:00Z`, locale) : null,
    row.type ? tt(`type_${row.type as "BUY"}`) : null,
    row.symbol,
    row.quantity,
    row.amount && row.currency ? formatMoney(row.amount, row.currency, locale, { signed: true }) : null,
    row.note,
  ].filter(Boolean);
  return <>{parts.join(" · ")}</>;
}

function Button({
  children,
  onClick,
  disabled,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={disabled}
      className={`h-11 justify-self-start rounded-[10px] px-4 font-semibold disabled:opacity-60 ${
        primary ? "bg-brand text-on-brand" : "border border-line text-brand"
      }`}
    >
      {children}
    </button>
  );
}

export function RevertButton({ batchId, label }: { batchId: string; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await revertImportAction(batchId);
            if (!res.ok) setError(res.error);
            router.refresh();
          })
        }
        className="text-[14px] font-semibold text-brand disabled:opacity-60"
      >
        {label}
      </button>
      {error ? (
        <span role="alert" className="ml-2 text-[13px] text-down">
          {error}
        </span>
      ) : null}
    </span>
  );
}
