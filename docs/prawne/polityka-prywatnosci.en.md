# Neto Privacy Policy

> **DRAFT — subject to approval by legal counsel (SZKIC — do zatwierdzenia przez radcę).** Working version 0.1, 02.11.2026 (Stage 12). Do not publish before approval. English translation of `polityka-prywatnosci.md`; in case of discrepancy the Polish version prevails [TO BE CONFIRMED BY COUNSEL].

**Placeholders to fill in:** [CONTROLLER NAME], [CONTROLLER ADDRESS], [TAX ID / REGISTRY NUMBERS], [PRIVACY E-MAIL], [DPO], [E-MAIL PROVIDER], [PRICING PROVIDER], [BOT PROTECTION], [SUPABASE REGION], [VERCEL REGION], [SENTRY REGION], [BACKUP PERIOD], [SECURITY LOG PERIOD], [ERROR REPORT PERIOD], [E-MAIL LOG PERIOD], [CORRESPONDENCE PERIOD], [MINIMUM AGE], [NOTICE DAYS], [EFFECTIVE DATE], [TO BE FILLED IN] (data location of providers not yet chosen), [TO BE DECIDED] (retention of request records). Each corresponds to the bracketed field with the same meaning in the Polish version.

---

## 1. Who is the controller

The controller of your personal data is [CONTROLLER NAME], [CONTROLLER ADDRESS], [TAX ID / REGISTRY NUMBERS] (“we”). Neto is a web app (also installable as a PWA) and an iPhone app; both use the same account and the same data.

Privacy contact: [PRIVACY E-MAIL]. [DPO]

## 2. Where the data comes from

You enter almost all data yourself: at sign-up, in settings, when adding accounts, transactions, valuations and goals, or by importing a CSV file. Some data is created automatically when you use Neto (e.g. sessions, security events, error reports). If you sign in with Google, Google gives us your e-mail address, your name (if present in your profile) and your Google account identifier.

Neto **does not connect to your bank or brokerage** and does not download data from them.

## 3. What data we process

The category names below are used verbatim in the App Store privacy labels (`docs/sklep/etykiety-prywatnosci.md`). Changing a category name or scope requires changing both.

| No. | Category                  | Includes                                                                                                                                                                             |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| K1  | Contact data              | e-mail address; first name or display name (optional)                                                                                                                                |
| K2  | Profile data              | year of birth (optional, for the retirement calculator), language, theme, number format, privacy mode                                                                                |
| K3  | Sign-in data              | password hash (argon2id; we never know your password), encrypted 2FA secret, backup code hashes, Google account identifier, internal user identifier                                 |
| K4  | Session and security data | truncated IP address, browser or device type (user agent), platform (web or iOS), sign-in and last-activity time, security events                                                    |
| K5  | Financial data            | accounts and their types, institution names, account numbers (encrypted), balances, transactions, holdings, asset valuations, deposits, bonds, loans, ownership share, value history |
| K6  | Goals and retirement plan | goal names and amounts, deadlines, retirement calculator assumptions (incl. planned spending, expected state pension, contributions)                                                 |
| K7  | User content              | account and goal names, notes (encrypted), CSV import file names and column mappings                                                                                                 |
| K8  | Push device identifier    | iPhone push notification token, app version (only if you enable push notifications)                                                                                                  |
| K9  | Diagnostic data           | error and crash reports, performance data (no amounts and no financial data)                                                                                                         |
| K10 | Correspondence            | content of messages to us, sender's e-mail address                                                                                                                                   |

What we do **not** collect: location, contacts, photos, browsing history, health data, advertising data. We do not use analytics or tracking (version 1.0). Face ID / Touch ID lock runs entirely on your iPhone: we receive no biometric data. Instrument search is handled in real time and we do not store search terms.

Financial data is not a special category under Article 9 GDPR, but we treat it as sensitive: selected fields are encrypted in the database (AES-256-GCM) and amounts are never written to logs.

## 4. Purposes and legal bases

| Purpose                                                                                 | Categories     | Legal basis                                                                         |
| --------------------------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------- |
| Creating and running the account, sign-in, 2FA, sync between web and iPhone             | K1, K2, K3     | Art. 6(1)(b) GDPR — performance of a contract (Terms)                               |
| Providing the service: storing data, daily valuation, charts, goals, calculator, export | K2, K5, K6, K7 | Art. 6(1)(b) GDPR                                                                   |
| In-app and e-mail notifications (weekly summary, goal reached, valuations)              | K1, K5, K6     | Art. 6(1)(b) GDPR; you can switch them off in settings                              |
| Push notifications on iPhone                                                            | K8             | Art. 6(1)(b) GDPR; push works only after you allow it in iOS, and you can revoke it |
| Security e-mails (new device, password or 2FA change, password reset)                   | K1, K4         | Art. 6(1)(f) GDPR — legitimate interest: protecting your account                    |
| Security: sign-in limits, bot protection, event log, session list                       | K3, K4         | Art. 6(1)(f) GDPR — protecting the service and accounts against abuse               |
| Detecting and fixing errors                                                             | K3, K9         | Art. 6(1)(f) GDPR — keeping the service working                                     |
| Contact and handling requests, including complaints                                     | K1, K10        | Art. 6(1)(b) GDPR (contract matters), Art. 6(1)(f) GDPR (other)                     |
| Handling your GDPR rights and demonstrating that we did                                 | K1, K4, K10    | Art. 6(1)(c) GDPR — legal obligation (Arts. 12–22 and 5(2) GDPR)                    |
| Establishing, exercising or defending legal claims                                      | K1, K4, K10    | Art. 6(1)(f) GDPR                                                                   |

We do not make decisions based solely on automated processing that produce legal effects concerning you (Art. 22 GDPR). In-app calculations (valuation, goal pace, retirement scenarios) are computations on your data shown only to you.

Data in K1 and K3 is required to create an account. Everything else is voluntary; without it some features will not work (e.g. the calculator without a year of birth).

## 5. Who receives the data

We do not sell data or share it with advertisers. We share data only with providers that help us run the service, under data processing agreements (Art. 28 GDPR), unless stated otherwise.

| Recipient                                  | Role                                                 | Categories                       | Data location               |
| ------------------------------------------ | ---------------------------------------------------- | -------------------------------- | --------------------------- |
| Supabase Inc.                              | database and backups                                 | K1–K8, K10 (if in database)      | [SUPABASE REGION] (EU)      |
| Vercel Inc.                                | app hosting, server execution, technical logs        | all, while processing            | [VERCEL REGION]; US company |
| Google Ireland Ltd / Google LLC (Firebase) | delivering push notifications to iPhone              | K8 and push text without amounts | EU and US                   |
| [E-MAIL PROVIDER]                          | sending transactional e-mails                        | K1 and e-mail content            | [TO BE FILLED IN]           |
| Functional Software Inc. (Sentry)          | error reports                                        | K3 (identifier), K9              | [SENTRY REGION]             |
| [BOT PROTECTION]                           | protecting the sign-up form against bots             | K4                               | [TO BE FILLED IN]           |
| [PRICING PROVIDER]                         | instrument prices                                    | no personal data¹                | [TO BE FILLED IN]           |
| Google (Sign in with Google)               | separate controller of your data at Google           | data listed in section 2         | per Google's policy         |
| Apple Inc.                                 | separate controller: App Store, push delivery (APNs) | per Apple's policy               | per Apple's policy          |
| public authorities                         | only where required by law                           | as requested                     | —                           |

¹ We send the pricing provider only instrument symbols and dates, with no user identifier and no quantities. Narodowy Bank Polski (exchange rates) receives no data about you either.

At sign-up and password change we may check whether the password appears in public breaches (Pwned Passwords). We send only the first 5 characters of the password's SHA-1 hash; neither the password nor the e-mail leaves our server.

## 6. Transfers outside the European Economic Area

Some providers (Vercel, Google/Firebase, Sentry, [E-MAIL PROVIDER]) are US companies or use sub-processors outside the EEA. Transfers are based on:

- the European Commission adequacy decision for the US (EU-US Data Privacy Framework), where the recipient is certified, or
- standard contractual clauses adopted by the European Commission (Art. 46(2)(c) GDPR).

You can get a copy of the safeguards by writing to [PRIVACY E-MAIL].

## 7. How long we keep data

| Data                                                   | Period                                                                                                                    |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Account and data in K1, K2, K3, K5, K6, K7             | until the account is deleted; after a deletion request — a 14-day grace period, then permanent deletion from the database |
| Database backups                                       | data deleted from the database disappears from backups no later than after [BACKUP PERIOD]                                |
| Sessions (K4)                                          | until sign-out or 30 days of inactivity on the web and 90 days on iPhone                                                  |
| Security event log (K4)                                | [SECURITY LOG PERIOD]                                                                                                     |
| E-mail verification and password reset links           | 24 hours (verification), 1 hour (reset); single use                                                                       |
| Push token (K8)                                        | until you switch off push, sign out on the iPhone or delete the account                                                   |
| Error reports (K9)                                     | [ERROR REPORT PERIOD]                                                                                                     |
| E-mail delivery logs at the provider                   | [E-MAIL LOG PERIOD]                                                                                                       |
| Correspondence (K10)                                   | [CORRESPONDENCE PERIOD]                                                                                                   |
| Record of a completed GDPR request or account deletion | [TO BE DECIDED] — e-mail address and date, only to demonstrate accountability                                             |

## 8. Your rights

You have the right to:

- **access** your data and get a copy,
- **rectify** your data (you can change most of it yourself in the app),
- **erase** your data — in the app: Settings → Data → Delete account (see the “How to delete your account” page),
- **restrict** processing,
- **data portability** — in the app: Settings → Data → Export (a ZIP file with JSON and CSV),
- **object** to processing based on legitimate interest (Art. 6(1)(f) GDPR),
- **withdraw consent** to push notifications in iOS settings at any time, without affecting earlier processing,
- **lodge a complaint** with the Polish supervisory authority, Prezes Urzędu Ochrony Danych Osobowych (uodo.gov.pl), or the authority in your country of residence.

Send requests to [PRIVACY E-MAIL]. We reply within one month (extendable by two months where justified — we will tell you). We may ask you to confirm your identity, e.g. by writing from the address linked to your account.

## 9. Security

Passwords are stored as argon2id hashes. We offer 2FA (TOTP app) and a list of active sessions with sign-out of all of them. Connections are encrypted (HTTPS, HSTS). Selected fields (notes, account numbers, 2FA secret) are encrypted in the database. Logs contain no amounts and no personal data other than a truncated IP address. The app does not store financial data in the device's offline storage. On iPhone you can turn on Face ID / Touch ID lock and the privacy mode that hides amounts.

## 10. Age

Neto is intended for people aged [MINIMUM AGE] or older.

## 11. Cookies

We use only cookies strictly necessary for the app to work. Details: Cookie Policy.

## 12. Changes

We will announce material changes in the app and by e-mail at least [NOTICE DAYS] days in advance. The current version and its effective date are always on this page.

Effective date: [EFFECTIVE DATE].
