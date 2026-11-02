import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Izolacja danych użytkowników (SPEC sekcja 8, „Reguły dostępu”).
 * Każdy odczyt i zapis przez `scopedDb(base, userId)` jest automatycznie zawężony do właściciela:
 *  - cudze rekordy są niewidoczne (odczyt zwraca null/[], zmiana kończy się błędem „nie znaleziono”),
 *  - tworzenie wymusza userId albo sprawdza, czy rodzic (konto, pozycja, cel) należy do użytkownika,
 *  - zagnieżdżone zapisy relacji są zablokowane (twórz rekordy podrzędne osobnym wywołaniem),
 *  - tabele globalne (ceny, kursy) są tylko do odczytu.
 * Nowy model w schemacie MUSI dostać wpis w `policies`; test w scoped.db.test.ts pilnuje kompletności.
 */

type Where = Record<string, unknown>;

type Policy =
  | { kind: "self" } // User: tylko własny rekord
  | { kind: "owner"; field: "userId" } // userId bezpośrednio
  | { kind: "catalog" } // Asset: odczyt katalogu wspólnego + własne; zapis tylko własne
  | { kind: "via"; filter: (userId: string) => Where; parents: ParentCheck[] }
  | { kind: "global" }; // tylko odczyt

type ParentCheck = { field: string; model: "financialAccount" | "holding" | "goal" | "asset" };

const viaAccount = (userId: string): Where => ({ account: { userId } });

export const policies: Record<string, Policy> = {
  User: { kind: "self" },
  Account: { kind: "owner", field: "userId" },
  Session: { kind: "owner", field: "userId" },
  BackupCode: { kind: "owner", field: "userId" },
  AuditLog: { kind: "owner", field: "userId" },
  FinancialAccount: { kind: "owner", field: "userId" },
  ImportBatch: { kind: "owner", field: "userId" },
  ImportMapping: { kind: "owner", field: "userId" },
  PortfolioSnapshot: { kind: "owner", field: "userId" },
  RecalcJob: { kind: "owner", field: "userId" },
  Goal: { kind: "owner", field: "userId" },
  RetirementPlan: { kind: "owner", field: "userId" },
  Notification: { kind: "owner", field: "userId" },
  NotificationPref: { kind: "owner", field: "userId" },
  PushDevice: { kind: "owner", field: "userId" },
  Asset: { kind: "catalog" },
  Liability: {
    kind: "via",
    filter: viaAccount,
    parents: [{ field: "accountId", model: "financialAccount" }],
  },
  Deposit: {
    kind: "via",
    filter: viaAccount,
    parents: [
      { field: "accountId", model: "financialAccount" },
      { field: "payoutAccountId", model: "financialAccount" },
    ],
  },
  Holding: {
    kind: "via",
    filter: viaAccount,
    parents: [
      { field: "accountId", model: "financialAccount" },
      { field: "assetId", model: "asset" },
    ],
  },
  Transaction: {
    kind: "via",
    filter: viaAccount,
    parents: [
      { field: "accountId", model: "financialAccount" },
      { field: "assetId", model: "asset" },
    ],
  },
  Lot: {
    kind: "via",
    filter: (userId) => ({ holding: { account: { userId } } }),
    parents: [{ field: "holdingId", model: "holding" }],
  },
  GoalAccount: {
    kind: "via",
    filter: (userId) => ({ goal: { userId }, account: { userId } }),
    parents: [
      { field: "goalId", model: "goal" },
      { field: "accountId", model: "financialAccount" },
    ],
  },
  RetailBondSeries: {
    kind: "via",
    filter: (userId) => ({ asset: { OR: [{ userId }, { userId: null }] } }),
    parents: [{ field: "assetId", model: "asset" }],
  },
  PriceSnapshot: { kind: "global" },
  FxRate: { kind: "global" },
  VerificationToken: { kind: "global" },
  RateLimit: { kind: "global" },
};

export class ScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScopeError";
  }
}

const READ = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
]);
const UNIQUE = new Set(["findUnique", "findUniqueOrThrow", "update", "delete", "upsert"]);
const CREATE = new Set(["create", "createMany", "createManyAndReturn"]);
const UPDATE = new Set(["update", "updateMany", "updateManyAndReturn"]);
const DELETE = new Set(["delete", "deleteMany"]);
const NESTED_OPS = [
  "create",
  "connect",
  "connectOrCreate",
  "createMany",
  "upsert",
  "set",
  "disconnect",
  "delete",
  "update",
  "updateMany",
  "deleteMany",
];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && Object.getPrototypeOf(v) === Object.prototype;
}

function assertNoNestedWrites(model: string, data: unknown) {
  const rows = Array.isArray(data) ? data : [data];
  for (const row of rows) {
    if (!isPlainObject(row)) continue;
    for (const [key, value] of Object.entries(row)) {
      if (isPlainObject(value) && NESTED_OPS.some((op) => op in value) && !isJsonField(key)) {
        throw new ScopeError(`${model}.${key}: zagnieżdżone zapisy relacji są zablokowane w scopedDb`);
      }
    }
  }
}

// Pola Json w schemacie: mogą zawierać dowolne obiekty, więc nie traktujemy ich jak relacji.
const JSON_FIELDS = new Set(["mapping", "meta", "data", "periodRates", "byClass", "byCurrency", "byAccount"]);
function isJsonField(key: string) {
  return JSON_FIELDS.has(key);
}

function scopeWhere(policy: Policy, userId: string, operation: string): Where | null {
  switch (policy.kind) {
    case "self":
      return { id: userId };
    case "owner":
      return { [policy.field]: userId };
    case "catalog":
      return READ.has(operation) ? { OR: [{ userId }, { userId: null }] } : { userId };
    case "via":
      return policy.filter(userId);
    case "global":
      return null;
  }
}

function mergeWhere(where: Where | undefined, scope: Where, unique: boolean): Where {
  if (unique) {
    const and = where?.AND;
    const existing = Array.isArray(and) ? and : and ? [and] : [];
    return { ...where, AND: [...existing, scope] };
  }
  return where ? { AND: [where, scope] } : scope;
}

type Args = Record<string, unknown> & { where?: Where; data?: unknown; create?: unknown; update?: unknown };

export function scopedDb(base: PrismaClient, userId: string) {
  if (!userId) throw new ScopeError("scopedDb wymaga userId");

  async function assertParents(model: string, policy: Policy, rows: unknown) {
    if (policy.kind !== "via") return;
    const list = (Array.isArray(rows) ? rows : [rows]).filter(isPlainObject);
    for (const parent of policy.parents) {
      const ids = [
        ...new Set(list.map((r) => r[parent.field]).filter((v): v is string => typeof v === "string")),
      ];
      if (ids.length === 0) continue;
      const owned = await countOwned(parent.model, ids);
      if (owned !== ids.length) {
        throw new ScopeError(`${model}.${parent.field}: rekord nadrzędny nie należy do użytkownika`);
      }
    }
  }

  function countOwned(model: ParentCheck["model"], ids: string[]): Promise<number> {
    const id = { in: ids };
    switch (model) {
      case "financialAccount":
        return base.financialAccount.count({ where: { id, userId } });
      case "holding":
        return base.holding.count({ where: { id, account: { userId } } });
      case "goal":
        return base.goal.count({ where: { id, userId } });
      case "asset":
        // Pozycję można założyć na instrumencie z katalogu wspólnego albo własnym.
        return base.asset.count({ where: { id, OR: [{ userId }, { userId: null }] } });
    }
  }

  function enforceOwnerData(model: string, policy: Policy, data: unknown): unknown {
    if (policy.kind !== "owner" && policy.kind !== "catalog") return data;
    const field = policy.kind === "owner" ? policy.field : "userId";
    const fix = (row: unknown) => {
      if (!isPlainObject(row)) return row;
      if (field in row && row[field] !== userId) {
        throw new ScopeError(`${model}.${field}: nie można zapisać danych innego użytkownika`);
      }
      if ("user" in row) throw new ScopeError(`${model}.user: użyj pola ${field}, nie relacji`);
      return { ...row, [field]: userId };
    };
    return Array.isArray(data) ? data.map(fix) : fix(data);
  }

  function assertUpdateKeepsOwner(model: string, policy: Policy, data: unknown) {
    if (!isPlainObject(data)) return;
    if (
      (policy.kind === "owner" || policy.kind === "catalog") &&
      "userId" in data &&
      data.userId !== userId
    ) {
      throw new ScopeError(`${model}.userId: nie można przenieść rekordu do innego użytkownika`);
    }
    if (policy.kind === "self" && "id" in data && data.id !== userId) {
      throw new ScopeError("User.id: nie można zmienić identyfikatora");
    }
  }

  return base.$extends({
    name: "neto-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query: rawQuery }) {
          // Argumenty przekształcamy dynamicznie, więc typ zapytania zawężamy tutaj, w jednym miejscu.
          const query = rawQuery as (args: unknown) => Promise<unknown>;
          const policy = policies[model];
          if (!policy) throw new ScopeError(`Model ${model} nie ma reguły dostępu w policies`);
          const a = (args ?? {}) as Args;

          if (policy.kind === "global") {
            if (!READ.has(operation)) throw new ScopeError(`${model}: tabela globalna tylko do odczytu`);
            return query(a);
          }
          if (
            policy.kind === "self" &&
            (CREATE.has(operation) || DELETE.has(operation) || operation === "upsert")
          ) {
            throw new ScopeError("User: tworzenie i usuwanie konta tylko przez moduł auth");
          }

          const scope = scopeWhere(policy, userId, operation)!;

          if (CREATE.has(operation)) {
            assertNoNestedWrites(model, a.data);
            const data = enforceOwnerData(model, policy, a.data);
            await assertParents(model, policy, data);
            return query({ ...a, data });
          }

          if (operation === "upsert") {
            assertNoNestedWrites(model, a.create);
            assertNoNestedWrites(model, a.update);
            const create = enforceOwnerData(model, policy, a.create);
            assertUpdateKeepsOwner(model, policy, a.update);
            await assertParents(model, policy, create);
            await assertParents(model, policy, a.update);
            return query({ ...a, where: mergeWhere(a.where, scope, true), create });
          }

          if (UPDATE.has(operation)) {
            assertNoNestedWrites(model, a.data);
            assertUpdateKeepsOwner(model, policy, a.data);
            await assertParents(model, policy, a.data);
          }

          return query({ ...a, where: mergeWhere(a.where, scope, UNIQUE.has(operation)) });
        },
      },
    },
  });
}

export type ScopedDb = ReturnType<typeof scopedDb>;
