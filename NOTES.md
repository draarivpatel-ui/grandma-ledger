# Notes: Two-Crayon Kitchen & Bill Book (grandma-ledger)

Written 2026-10-25 (clock: `date` said Sun Oct 25 2026, 12:56 CDT). Read this before entering anything in Hack Club's Help Grandma Out.

## The one thing to decide first: this is not eligible for cookies as it stands

Read live from https://grandma.hackclub.com/ on 2026-10-25 (the home page and its FAQ):

- "Can I use AI? Use of AI must strictly be under 30% of total time."
- "Can I make changes to my old projects and ship it with additional hours? No, the project must be created AFTER you have asked grandma."
- Hours are logged with Hackatime and the project is shipped from there. Ages 13 to 18. Software only. Code must be public.
- The home page said "Grandma calls soon" with a launch time of 2026-10-15 in its page data. I did not find the end date `Nov 30, 2026` on the pages I read, so that date is **reported by the task brief, not verified**.

What that means for this repo:

1. It was written almost entirely by an AI assistant in one sitting. That is far over the 30% AI limit.
2. It was created before anyone asked Grandma for a demand, and before any Hackatime hours. The program says the project has to start after the ask.
3. The four demands (Two Colors, Offline, No Jargon, No Libraries) are ones I picked from her examples. Grandma assigns the real ones.

So treat it as a portfolio and open-source project that follows the spirit of four of her demands. Do not put it into the Pantry as a normal entry without asking the organizers (the program's Slack channel is `#grandma`). I did not contact anyone, sign in anywhere, or submit anything.

If the goal is cookies, the honest path is a new project, started after asking Grandma, with the hours logged and the code mostly the entrant's own. This repo could be a reference for that, not the entry.

## What was built and what was checked

Everything below was run in this session. Counts come from the tools, not from memory.

| Check | Result |
| --- | --- |
| `npm test` | 141 pass, 0 fail (89 engine, 52 page smoke) |
| Hark audit (`--audit`) | 0 violations in 16 files |
| Planted defects, count 25 | 25 of 25 caught |
| Planted defects, count 400 (all 96 that exist in `js/engine.js`) | 96 of 96 caught |
| Live page check in a real Chrome page (`http://127.0.0.1:8321/`) | all four rules passed: 654 parts of the page, 17 own files read, 18 files saved on the device by the saved copy |
| Offline for real | with the local web server stopped, a reload still loaded the whole book from the saved copy, all three fonts loaded, and all four rules passed again |
| Phone width (390) and 320 | no horizontal overflow on the page. The ledger table scrolls inside its own box. |
| Print | styles written; the print dialog itself was not exercised in a real printer or print preview |

Not verified:

- The live site result is recorded in the section "Push and web address" at the end of this file.
- Installing the book to a home screen (the manifest and PNG icons exist; nobody tried installing).
- Any other browser than Chrome. The brief asked for animation checks in a focused real browser. The only animation is the stamp pressing down and a slow dot drift on the sample page. I checked screenshots, not frame rates.
- Screen reader behavior. Labels, landmarks and focus rings are in place and tested as text, but nobody listened to it.

## Things that behave in a way you might not expect

- The harness `run_planted_defects` only mutates files in `js/` when that folder exists. That is why the math sits alone in `js/engine.js`, and why `app.js`, `render.js`, `share.js` and `sw.js` sit at the top level. The page files are covered by the smoke tests, not by planted defects.
- The page's live check found two real mistakes while I built it, which is the point of it: radio buttons and the Remove buttons were using the device's default colors. Both were fixed.
- The saved copy fetches fresh files on install (`cache: 'reload'`), because the first version cached stale files from the browser's short-term memory. Whoever changes a file must bump `BOOK_VERSION` in `files.js`.
- The plain English check is a word list. It proves no hard computer words slipped in. It does not prove the writing is plain.
- Two crayons allow ink thinned by alpha. If a stricter reading is wanted ("no tints at all"), the shades in `tokens.css` and every dot pattern would have to go.

## Design record (stands in for the Hallmark questions, which cannot be asked in a non-interactive run)

- Audience: families who keep recipes, bills and medicine lists on paper. Use: scale, split, schedule, print. Tone: austere and warm (editorial). Inferred, not asked.
- Macrostructure: a bespoke ledger book (hero page, four parts, one inverted check section). Theme: custom, two crayons only. Nav: edge thumb tabs on wide screens, a bottom bar on phones. Footer: plain colophon. Motion verb: press, like a stamp or a thumb tab.
- Signature moment: the stamp pressing down when the live check finishes. Idle motion: the dots on the sample page drift slowly (off with reduced motion).
- Skills: `hallmark` rules were followed (locked tokens, roman headings, no eyebrow labels, no fake chrome, honest copy). `awwwards` and `build-awwwards-quality-sites` prescribe Next.js, GSAP, Lenis and Three.js. Those violate the No Libraries demand, so only their craft rules were used (every frame a poster, one signature moment, real hover and focus states, a phone layout composed for 390, no filler copy). Nothing here claims or implies an award.
- Illustration: only authored icons and data diagrams are drawn in SVG. There is no illustrative art and there are no photographs.
- Fonts: Fraunces (display), Plus Jakarta Sans (body), JetBrains Mono (fractions and ledger columns), Latin subset variable files from the Fontsource npm packages at 5.3.0, copied once into `fonts/`. They were downloaded at build time only. Nothing is requested at run time.

## Honesty and privacy

- None of the Hark gated rules (CrossSafe, BinCheck, TaalTrainer, Flag Call) apply to this project and none of their patterns are used.
- No personal details, photos, school, city or schedules appear anywhere. The sample names are Alma, Ben and Cora. The sample recipe, bills and card are made-up examples.
- No claim is made that anyone tested it besides the automated tests and a few runs by the builder. The README and page say it was written with an AI assistant.
- Git identity for this repo: `draarivpatel-ui` with the `noreply` address. The audit checks it.

## To do later, if wanted

- Try installing it on a phone and printing the care card on real paper.
- Add more kinds of pans or metric measures.
- Decide whether to keep this repo public given the eligibility note above (it is useful as open source either way).
