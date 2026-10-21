---
description: Add or change user-facing text in both English and Spanish
argument-hint: <area> <key> <English text>
---

Add the text described by `$ARGUMENTS` to the web app, in every language Conversa ships.

1. **Pick the file.** Messages live in `apps/web/messages/<locale>/<area>.json`, one file per area (`automations`, `channels`, `settings`, `errors`, `common`, ...). Use the area of the screen the text appears on; `common` only for words reused across areas.
2. **Add the key to every locale** listed in `LOCALES` (`packages/shared/src/enums.ts`) — today `en` and `es` — at the same path. A key that exists in English but not in Spanish is a bug.
3. **Write each language naturally.**
   - English: sentence case, plain, brief. Buttons start with a verb and name the object.
   - Spanish: Latin American, `tú`, natural word order. Do not translate word for word.
   - Variables use ICU: `"Due {date}"`; plurals `{count, plural, one {# contacto} other {# contactos}}`.
4. **Use it** with `useTranslations('<area>')` and `t('<key>')`. Keys are typed from the English tree, so `pnpm --filter @conversa/web typecheck` catches typos.
5. **Error codes** from the API go under `codes` in `errors.json`, in both languages. Field validation codes (`required`, `keywords_required`) go under `fields` in `errors.json`, where `useFieldErrors()` reads them.
6. **Audit actions** go under `audit.actions` in `settings.json`.
7. **Mola UI's built-in words** are not here: they are in `apps/web/src/i18n/mola-es.ts`.
8. Check: `pnpm --filter @conversa/web typecheck && pnpm --filter @conversa/web test`, and `pnpm format:check`.

Report the keys added and both texts.
