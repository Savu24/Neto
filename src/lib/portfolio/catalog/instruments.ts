import type { AssetClass } from "@/generated/prisma/enums";

/**
 * Katalog wspólny popularnych instrumentów (HU-2.2): tylko dane publiczne — nazwa, ticker, ISIN, rynek (MIC), waluta.
 * Bez cen. ISIN pusty tam, gdzie nie był pewny przy tworzeniu listy (do uzupełnienia, gdy podłączymy dostawcę).
 * Identyfikator rekordu jest stały (`cat-<rynek>-<ticker>`), więc ponowny seed aktualizuje, nie dubluje.
 */
export interface CatalogInstrument {
  readonly symbol: string;
  readonly name: string;
  readonly isin: string | null;
  readonly exchange: string | null;
  readonly assetClass: AssetClass;
  readonly currency: string;
}

const gpw = (symbol: string, name: string, isin: string | null): CatalogInstrument => ({
  symbol,
  name,
  isin,
  exchange: "XWAR",
  assetClass: "EQUITY",
  currency: "PLN",
});

const gpwEtf = (symbol: string, name: string): CatalogInstrument => ({
  symbol,
  name,
  isin: null,
  exchange: "XWAR",
  assetClass: "ETF",
  currency: "PLN",
});

const etf = (
  symbol: string,
  name: string,
  isin: string,
  exchange: string,
  currency: string,
): CatalogInstrument => ({ symbol, name, isin, exchange, assetClass: "ETF", currency });

export const CATALOG: readonly CatalogInstrument[] = [
  // GPW: spółki z WIG20/mWIG40 i inne popularne
  gpw("PKO", "PKO Bank Polski", "PLPKO0000016"),
  gpw("PKN", "Orlen", "PLPKN0000018"),
  gpw("PZU", "PZU", "PLPZU0000011"),
  gpw("PEO", "Bank Pekao", "PLPEKAO00016"),
  gpw("KGH", "KGHM Polska Miedź", "PLKGHM000017"),
  gpw("CDR", "CD Projekt", "PLOPTTC00011"),
  gpw("LPP", "LPP", "PLLPP0000011"),
  gpw("ALE", "Allegro.eu", "LU2237380790"),
  gpw("DNP", "Dino Polska", "PLDINPL00011"),
  gpw("SPL", "Santander Bank Polska", "PLBZ00000044"),
  gpw("MBK", "mBank", "PLBRE0000012"),
  gpw("OPL", "Orange Polska", "PLTLKPL00017"),
  gpw("CPS", "Cyfrowy Polsat", "PLCFRPT00013"),
  gpw("JSW", "Jastrzębska Spółka Węglowa", "PLJSW0000015"),
  gpw("KTY", "Grupa Kęty", "PLKETY000011"),
  gpw("BDX", "Budimex", "PLBUDMX00013"),
  gpw("PCO", "Pepco Group", "NL0015000AU7"),
  gpw("ALR", "Alior Bank", "PLALIOR00045"),
  gpw("KRU", "Kruk", "PLKRK0000010"),
  gpw("ACP", "Asseco Poland", "PLSOFTB00016"),
  gpw("PGE", "PGE Polska Grupa Energetyczna", "PLPGER000010"),
  gpw("TPE", "Tauron Polska Energia", "PLTAURN00011"),
  gpw("ENA", "Enea", "PLENEA000013"),
  gpw("CCC", "CCC", "PLCCC0000016"),
  gpw("ING", "ING Bank Śląski", "PLBSK0000017"),
  gpw("MIL", "Bank Millennium", "PLBIG0000016"),
  gpw("BHW", "Bank Handlowy w Warszawie", "PLBH00000012"),
  gpw("BFT", "Benefit Systems", "PLBNFTS00018"),
  gpw("XTB", "XTB", "PLXTRDM00011"),
  gpw("APR", "Auto Partner", "PLAUTPT00012"),
  gpw("ATT", "Grupa Azoty", "PLZATRM00012"),
  gpw("EUR", "Eurocash", "PLEURCH00011"),
  gpw("DOM", "Dom Development", "PLDMDVL00012"),
  gpw("TEN", "Ten Square Games", "PLTSQGM00016"),
  gpw("TXT", "Text", "PLLVTSF00010"),
  gpw("PKP", "PKP Cargo", "PLPKPCR00011"),

  // GPW: ETF-y (Beta ETF); ISIN do uzupełnienia
  gpwEtf("ETFBW20TR", "Beta ETF WIG20TR"),
  gpwEtf("ETFBM40TR", "Beta ETF mWIG40TR"),
  gpwEtf("ETFBS80TR", "Beta ETF sWIG80TR"),
  gpwEtf("ETFBSPXPL", "Beta ETF S&P 500 PLN-Hedged"),
  gpwEtf("ETFBNDXPL", "Beta ETF Nasdaq-100 PLN-Hedged"),

  // ETF-y UCITS na Xetrze, Euronext Amsterdam i LSE
  etf("VWCE", "Vanguard FTSE All-World UCITS ETF (Acc)", "IE00BK5BQT80", "XETR", "EUR"),
  etf("VWRL", "Vanguard FTSE All-World UCITS ETF (Dist)", "IE00B3RBWM25", "XAMS", "EUR"),
  etf("IWDA", "iShares Core MSCI World UCITS ETF (Acc)", "IE00B4L5Y983", "XAMS", "EUR"),
  etf("EUNL", "iShares Core MSCI World UCITS ETF (Acc)", "IE00B4L5Y983", "XETR", "EUR"),
  etf("SXR8", "iShares Core S&P 500 UCITS ETF (Acc)", "IE00B5BMR087", "XETR", "EUR"),
  etf("CSPX", "iShares Core S&P 500 UCITS ETF (Acc)", "IE00B5BMR087", "XLON", "USD"),
  etf("VUAA", "Vanguard S&P 500 UCITS ETF (Acc)", "IE00BFMXXD54", "XETR", "EUR"),
  etf("VUSA", "Vanguard S&P 500 UCITS ETF (Dist)", "IE00B3XXRP09", "XAMS", "EUR"),
  etf("IS3N", "iShares Core MSCI EM IMI UCITS ETF (Acc)", "IE00BKM4GZ66", "XETR", "EUR"),
  etf("EIMI", "iShares Core MSCI EM IMI UCITS ETF (Acc)", "IE00BKM4GZ66", "XLON", "USD"),
  etf("XDWD", "Xtrackers MSCI World UCITS ETF 1C", "IE00BJ0KDQ92", "XETR", "EUR"),
  etf("SPPW", "SPDR MSCI World UCITS ETF", "IE00BFY0GT14", "XETR", "EUR"),
  etf("IUSQ", "iShares MSCI ACWI UCITS ETF (Acc)", "IE00B6R52259", "XETR", "EUR"),
  etf("VEVE", "Vanguard FTSE Developed World UCITS ETF (Dist)", "IE00BKX55T58", "XAMS", "EUR"),
  etf("VFEM", "Vanguard FTSE Emerging Markets UCITS ETF (Dist)", "IE00B3VVMM84", "XAMS", "EUR"),
  etf("EXSA", "iShares STOXX Europe 600 UCITS ETF (DE)", "DE0002635307", "XETR", "EUR"),
  etf("EQQQ", "Invesco EQQQ Nasdaq-100 UCITS ETF", "IE0032077012", "XETR", "EUR"),
  etf("SXRV", "iShares Nasdaq 100 UCITS ETF (Acc)", "IE00B53SZB19", "XETR", "EUR"),
  etf("IS3Q", "iShares Edge MSCI World Quality Factor UCITS ETF", "IE00BP3QZ601", "XETR", "EUR"),
  etf("ZPRV", "SPDR MSCI USA Small Cap Value Weighted UCITS ETF", "IE00BSPLC413", "XETR", "EUR"),
  etf("ZPRX", "SPDR MSCI Europe Small Cap Value Weighted UCITS ETF", "IE00BSPLC298", "XETR", "EUR"),
  etf("AGGH", "iShares Core Global Aggregate Bond UCITS ETF EUR Hedged", "IE00BDBRDM35", "XAMS", "EUR"),
  etf("VAGF", "Vanguard Global Aggregate Bond UCITS ETF EUR Hedged (Acc)", "IE00BG47KH54", "XETR", "EUR"),
  etf("IBCI", "iShares € Inflation Linked Govt Bond UCITS ETF", "IE00B0M62X26", "XETR", "EUR"),
  etf("XEON", "Xtrackers II EUR Overnight Rate Swap UCITS ETF 1C", "LU0290358497", "XETR", "EUR"),
  {
    symbol: "IGLN",
    name: "iShares Physical Gold ETC",
    isin: "IE00B4ND3602",
    exchange: "XLON",
    assetClass: "COMMODITY",
    currency: "USD",
  },

  // Kryptowaluty: cena w USD (SPEC 7.1)
  { symbol: "BTC", name: "Bitcoin", isin: null, exchange: null, assetClass: "CRYPTO", currency: "USD" },
  { symbol: "ETH", name: "Ethereum", isin: null, exchange: null, assetClass: "CRYPTO", currency: "USD" },
];
