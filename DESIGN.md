# Design

Conversa's interface is built **only** with [Mola UI](https://demogar.github.io/molaui/) (`@demogar/mola-ui`). This page is the product's design direction: what Mola gives us, how Conversa uses it, and the rules a screen must meet. The how-to for code is the [frontend guide](docs/contributing/frontend-guide.md).

## The system: cut cloth

Mola is built like layered cloth with the top layer cut away to reveal the one beneath. That method is the visual grammar:

| Idea                  | In the interface                                                                                                                                                                                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Flat layers**       | Surfaces are cloth (`cloth`, `cloth-pale`, `cloth-shade`, `cloth-deep`), stacked, never floating on soft shadows.                                                                                                                                              |
| **Zero radius**       | Every corner is square. Never add `rounded-*`.                                                                                                                                                                                                                 |
| **Keylines**          | Interactive edges are ink keylines drawn with `box-shadow` (`keyline`, `keyline-soft`), so hover can grow a revealed band outward without moving anything. Controls never get a `border`.                                                                      |
| **The revealed band** | Hover, selection and the current item show a cut (`cut`, `band`, `bar-start`), not a colour wash.                                                                                                                                                              |
| _**Relleno**_         | The filler slits of a mola. In Mola it is the divider, the empty state, and, moving, the indeterminate "working" state. Use Mola's progress and empty-state components; never a spinner.                                                                       |
| **Tokens only**       | Colours, spacing, motion and elevation come from tokens (`ink`, `ink-muted`, `accent`, `danger`, `success`, `warn`, `info`, their `-soft` tints, `shadow-cut`). No hex values, no Tailwind default palette. Both themes are declared once with `light-dark()`. |

### Three typefaces, three speakers

| Face                     | Speaks for           | In Conversa                                                                                                     |
| ------------------------ | -------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Archivo** (width axis) | The system           | Navigation, labels, buttons, tables, headings.                                                                  |
| **Alegreya**             | Prose a person wrote | The text of a DM or public reply in previews and the inbox, comment text in the activity log, the legal pages.  |
| **Martian Mono**         | Machine literals     | Keywords as typed, error and request ids, tracked-link slugs, URLs, webhook and callback URLs in setup screens. |

So a screen can be scanned for _what someone said_ versus _what the system did_ from the type alone.

### Density and theme

The app runs at `comfortable` density by default. Light and dark themes are both first-class; people pick one (or the system's) in the preferences bar.

## Product voice

Conversa is a tool people leave running while they post. The voice is calm, specific and brief.

- **Say what it does, in the reader's terms.** "Answers comments on your next post", not "NEXT_POST scope".
- **Sentence case** everywhere. No exclamation marks, no "Oops".
- **Buttons start with a verb and name the object:** "Connect Instagram account", "Delete automation", "Send event". Not "OK", "Submit", "Yes".
- **Errors say what happened and what to do next:** "Buffer stopped accepting the API key. Connect again with a new key." Never show a raw code alone; never blame the reader.
- **Permissions are explained, not hidden behind a disabled control:** "Only workspace owners and admins can connect or disconnect accounts", with who to ask.
- **Instagram's rules are stated plainly** where they bite (one private reply per comment, the 24-hour window, 750 replies an hour), once, near the control they affect.
- **Spanish is written, not translated:** Latin American, `tú`, natural word order.

## States

Every screen that loads data has all of these, built from Mola's components:

| State         | Use                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Loading       | `Skeleton` / `SkeletonGroup`, or the table's loading rows, shaped like the content. Never a spinner.                     |
| Empty         | `EmptyState kind="empty"`: what will appear here and the action that makes it appear.                                    |
| No results    | `EmptyState kind="no-results"`: for filters and search, with a way to clear them.                                        |
| Error         | `EmptyState kind="error"` with **Retry**, and the translated error message.                                              |
| No permission | The values as text plus a `Callout` naming who can change them.                                                          |
| Working       | Mola's indeterminate progress (moving relleno) for anything that runs in the background, such as a connection or a sync. |

Further rules:

- **State is never colour alone.** A status is a square mark, a word and a tone (`Badge` with a dot): "Active", "Paused", "Needs reconnecting".
- **Destructive actions** go through `AlertDialog`, name the object, and say what is lost.
- **Results that happen elsewhere** (an event sent, a key saved) are confirmed with a toast.
- **Logical properties** (`ps-`, `me-`, `start-`) so the layout can mirror for right-to-left.
- **Disabled is rare.** Prefer explaining why something cannot be done over a greyed-out control.

## Checking a screen

- `pnpm --filter @conversa/web lint` runs Mola's design rules (`@demogar/mola-ui/eslint`).
- The Mola MCP server (`.mcp.json`) has `check_code`, which reviews a screen and cites the rule each problem breaks, and `get_component`, `get_pattern`, `get_tokens` for the installed version.
- Before inventing a layout, look for a Mola pattern: settings page with save bar, filtered table, list and detail, destructive confirmation, empty states, form validated on submit.

## References

- Mola UI Storybook: https://demogar.github.io/molaui/
- For agents: https://demogar.github.io/molaui/llms.txt (components, tokens, patterns, rules)
- Component manifest in the installed package: `node_modules/@demogar/mola-ui/docs/ai/components.json`
