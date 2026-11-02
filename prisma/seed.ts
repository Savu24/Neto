/**
 * Dane przykładowe zgodne z makietami (docs/mockups). Tylko baza lokalna:
 * odmawia działania, gdy DATABASE_URL nie wskazuje localhost/127.0.0.1.
 *   npm run db:seed
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";

try {
  process.loadEnvFile(".env.local");
} catch {
  // brak pliku
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Brak DATABASE_URL (npm run db:start zapisze go do .env.local)");
const host = new URL(url).hostname;
if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
  throw new Error(`Seed działa tylko na bazie lokalnej, a DATABASE_URL wskazuje ${host}`);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
const DEMO_EMAIL = "demo@neto.localhost";
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

async function main() {
  await db.user.deleteMany({ where: { email: DEMO_EMAIL } });
  const user = await db.user.create({
    data: { email: DEMO_EMAIL, name: "Kasia (demo)", birthYear: 1992, emailVerified: new Date() },
  });
  const u = user.id;

  const vwce = await db.asset.upsert({
    where: { id: "seed-asset-vwce" },
    update: {},
    create: {
      id: "seed-asset-vwce",
      name: "Vanguard FTSE All-World UCITS ETF (Acc)",
      symbol: "VWCE",
      isin: "IE00BK5BQT80",
      exchange: "XETR",
      assetClass: "ETF",
      currency: "EUR",
      priceSource: "MANUAL",
    },
  });

  const acc = (data: Omit<Prisma.FinancialAccountUncheckedCreateInput, "userId">) =>
    db.financialAccount.create({ data: { ...data, userId: u } });

  const checking = await acc({ name: "Konto osobiste", kind: "ASSET", type: "CHECKING", currency: "PLN" });
  const savings = await acc({
    name: "Konto oszczędnościowe",
    kind: "ASSET",
    type: "SAVINGS",
    currency: "PLN",
  });
  const ike = await acc({
    name: "IKE",
    kind: "ASSET",
    type: "BROKERAGE",
    currency: "PLN",
    taxWrapper: "IKE",
  });
  const flat = await acc({ name: "Mieszkanie, Gdańsk", kind: "ASSET", type: "REAL_ESTATE", currency: "PLN" });
  const mortgage = await acc({
    name: "Kredyt hipoteczny",
    kind: "LIABILITY",
    type: "MORTGAGE",
    currency: "PLN",
  });

  await db.transaction.createMany({
    data: [
      {
        accountId: checking.id,
        type: "BALANCE_SET",
        date: d("2026-11-01"),
        amount: "18469.98",
        currency: "PLN",
      },
      {
        accountId: savings.id,
        type: "BALANCE_SET",
        date: d("2026-11-01"),
        amount: "52300.00",
        currency: "PLN",
      },
      { accountId: flat.id, type: "VALUATION", date: d("2026-06-12"), amount: "620000.00", currency: "PLN" },
      {
        accountId: mortgage.id,
        type: "BALANCE_SET",
        date: d("2026-11-01"),
        amount: "548320.25",
        currency: "PLN",
      },
      {
        accountId: ike.id,
        assetId: vwce.id,
        type: "BUY",
        date: d("2025-03-10"),
        quantity: "262",
        price: "108.6260",
        amount: "-28460.00",
        currency: "EUR",
        fxRate: "4.3984",
      },
    ],
  });
  await db.liability.create({
    data: { accountId: mortgage.id, interestRate: "0.0712", monthlyPayment: "3412.00" },
  });
  await db.priceSnapshot.upsert({
    where: { assetId_date: { assetId: vwce.id, date: d("2026-11-02") } },
    update: {},
    create: { assetId: vwce.id, date: d("2026-11-02"), close: "132.64", currency: "EUR", source: "seed" },
  });
  await db.fxRate.upsert({
    where: { date_currency: { date: d("2026-11-02"), currency: "EUR" } },
    update: {},
    create: { date: d("2026-11-02"), currency: "EUR", ratePln: "4.2648", table: "A", source: "seed" },
  });
  await db.goal.create({
    data: {
      userId: u,
      name: "Poduszka na 6 miesięcy",
      kind: "SAVINGS",
      targetAmount: "60000",
      targetDate: d("2027-03-31"),
      isMain: true,
      accounts: { create: [{ accountId: savings.id }] },
    },
  });

  console.log(
    `Seed gotowy: ${DEMO_EMAIL}, kont: ${await db.financialAccount.count({ where: { userId: u } })}.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
