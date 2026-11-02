# Neto Cookie Policy

> **DRAFT — subject to approval by legal counsel (SZKIC — do zatwierdzenia przez radcę).** Working version 0.1, 03.11.2026 (Stage 10, translated from the Stage 12 draft). Do not publish before approval. English translation of `polityka-cookies.md`; in case of discrepancy the Polish version prevails [TO BE CONFIRMED BY COUNSEL].

**Placeholders to fill in:** [CONTROLLER NAME], [PRIVACY E-MAIL], [BOT PROTECTION], [BOT PROTECTION COOKIES] (provider name and its cookies, or delete the row), [TO BE FILLED IN] (how long those cookies are kept), [EFFECTIVE DATE]. Each corresponds to the bracketed field with the same meaning in the Polish version.

**To confirm after Stage 4:** the Auth.js cookie names below are the library defaults. Before publication compare them with the cookies actually set in the browser (developer tools → Application → Cookies) on the production version.

---

## 1. What cookies are

Cookies are small files that a website stores in your browser or in an app. The browser's local storage and the PWA app cache (service worker) work in a similar way; the rules below apply to all of these technologies.

## 2. Which cookies we use

In version 1.0 Neto uses **only cookies strictly necessary** for the service you ask for. We do not use analytics, advertising or tracking cookies, including from third parties.

| Name                                                                   | What it is for                                                  | Set by           | How long                                                          |
| ---------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------- | ----------------------------------------------------------------- |
| `authjs.session-token` (in production `__Secure-authjs.session-token`) | keeping you signed in                                           | Neto             | until you sign out; 30 days of inactivity (web), 90 days (iPhone) |
| `authjs.csrf-token` (in production `__Host-authjs.csrf-token`)         | protecting sign-in forms against CSRF attacks                   | Neto             | until the browser is closed                                       |
| `authjs.callback-url` (in production `__Secure-authjs.callback-url`)   | returning to the right page after sign-in, including via Google | Neto             | until the browser is closed                                       |
| `neto-locale`                                                          | remembering your language (PL/EN)                               | Neto             | 1 year                                                            |
| `neto-theme`                                                           | remembering your theme (light/dark/system)                      | Neto             | 1 year                                                            |
| [BOT PROTECTION COOKIES]                                               | telling humans from bots at registration                        | [BOT PROTECTION] | [TO BE FILLED IN]                                                 |

The app cache (service worker) stores only the app shell and the "You are offline" page, **without your financial data**.

When you sign in with Google you go to a Google page, which uses its own cookies under Google's policy.

## 3. Legal basis and consent

Strictly necessary cookies do not require consent, because they serve only to provide the service you ask for (Article 399(3) of the Polish Electronic Communications Law — article number to be confirmed by counsel). That is why in version 1.0 we show only an information banner with a link to this policy, without consent buttons.

If we ever add analytics or other cookies that are not strictly necessary, we will ask for consent before storing them, and you will be able to withdraw it at any time. We will also update this policy.

## 4. How to manage cookies

You can delete or block cookies in your browser settings. Blocking strictly necessary cookies will make it impossible to sign in; blocking `neto-locale` or `neto-theme` will reset the language and theme to their defaults.

## 5. Contact

Controller: [CONTROLLER NAME]. Questions: [PRIVACY E-MAIL]. More about how we process data: Privacy Policy.

Effective date: [EFFECTIVE DATE].
