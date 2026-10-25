# Two-Crayon Kitchen & Bill Book

A recipe scaler, a grocery and bill splitter, and a weekly care card for medicine, plants and pantry shelves. It is printed in two colors, works with no internet, borrows no libraries, and is written in plain English.

Live at https://aariv.me/grandma-ledger/

It was built to follow four of the demands on Hack Club's Help Grandma Out (https://grandma.hackclub.com/). It is not an official entry. See "About Help Grandma Out" below before anyone treats it as one.

## The four demands, and how each is kept

| Demand | What this book does | How it is checked |
| --- | --- | --- |
| Two colors | Every pixel is warm cream paper (`#FAF5E8`) or deep Prussian ink (`#142850`). Shades come from thinning the ink with alpha, from dot and hatch patterns, and from line weight. | `tokens.css` is the only file that writes a color. `styles.css` writes none. A test scans every file, and the page reads the computed colors of all its own parts when it loads. |
| Works without internet | Fonts are kept inside the project. A saved copy (`sw.js`) keeps every file on the device after the first visit. Nothing is fetched from anywhere else. | A test checks the saved list against the files on disk. The page counts the saved files itself and says so. |
| No libraries | Plain HTML, CSS and JavaScript. `package.json` has empty `dependencies` and `devDependencies`. | A test checks the package file, every script tag and every script for imports. |
| No jargon | All reader-facing words are everyday English ("Keep a copy on paper", "Split the grocery slip"). | A test and the live check search every word the page can show against a list of hard computer words. A word list catches the usual suspects only. It cannot judge whether writing is truly plain. |

## What is in it

- **Scale the family recipe.** One ingredient per line. Amounts are exact fractions (Euclid's greatest common divisor), snapped to measures a cook can pour, and marked "about" with the exact figure underneath whenever they were rounded. Cups, tablespoons, teaspoons, fluid ounces, grams and ounces convert. Eggs stay whole.
- **Same batter, different pan.** Round and rectangle pans are compared by area, drawn to one scale, with the batter depth shown from the side.
- **Split the grocery slip.** Whole cents only. Shares always add back to the total, and the leftover cents rotate between people. The book finds the fewest handoffs. For up to 14 people who owe or are owed, it is exact: it finds the largest number of groups that settle inside themselves. Beyond that it falls back to a largest-first plan. It names the bills and coins for each handoff.
- **Keep the week on one card.** Morning, noon, evening and a Sunday check, with a box to tick, repeats caught and named, and a print layout.
- **Check that this book keeps its promises.** The page reads its own files, runs the same four checks as the tests, and stamps the result.
- **Keep a copy.** Print, or copy a link that carries the whole book in its tail (squeezed with the device's own tools when available).

The math lives in `js/engine.js`, which runs both in the page and in Node, so the same code is tested and shipped.

## Run it

Any plain file server works. For example:

```
python3 -m http.server 8080
```

then open http://127.0.0.1:8080/. Open it once while connected so the saved copy is made, then try it with the connection off.

## Test it

```
npm test
```

This uses only Node's built-in test runner. There are 141 tests: 89 for the engine and 52 smoke tests for the page. The smoke tests include a small stand-in page that runs `app.js` end to end, because a browser library would break the no libraries rule.

The Hark planted-defect check mutates `js/engine.js` and expects the tests to catch every change. Run against all 96 possible changes, all 96 are caught.

## Files

```
index.html       the page
tokens.css       the two crayons and every shade (the only file that writes a color)
styles.css       the look, using tokens only
js/engine.js     all the math and the four demand checks
render.js        turns answers into pieces of page and the two diagrams
app.js           reads the boxes, shows the answers
share.js         turns the book into a short piece of link text and back
files.js         the one list of files kept on the device
sw.js            the saved copy
manifest.json    lets the book be added to a home screen
fonts/           Fraunces, Plus Jakarta Sans, JetBrains Mono, with their licenses
tests/           engine and page tests
```

When any file changes, change `BOOK_VERSION` in `files.js` so devices fetch the new files.

## About Help Grandma Out

Checked live on 2026-10-25 from the program's own page (https://grandma.hackclub.com/):

- Cookies are paid for logged hours on projects built under the demands Grandma hands out. The page says the project must be created after you have asked Grandma, and hours are logged with Hackatime.
- The FAQ says use of AI must be strictly under 30% of total time.
- The program is for people aged 13 to 18, software only, with public code.

This project was written with an AI assistant (Claude) in a single sitting, and its four demands were chosen by us, not handed out by Grandma. That means it does **not** meet those published rules for a cookie payout as it stands. It is a working open-source project in the spirit of the demands. Nobody should submit it to the program as a normal entry without checking the rules again with the organizers.

## Honest limits

- The two crayon rule counts ink thinned with alpha as ink. On screen, a thinned ink over paper looks like a lighter tint, which is the point, and is how every shade here is made. Native parts of the device, such as scrollbars and the print dialog, are outside the page and cannot be checked by it.
- Baking advice is a rule of thumb about batter depth, not a promise. The care card is a reminder sheet and does not replace a doctor or pharmacist.
- Grams and ounces are not exact fractions of each other (1 ounce is about 28.35 grams), so those conversions are marked as close.
- Fonts come from the open Fontsource packages (version 5.3.0) of Fraunces, Plus Jakarta Sans and JetBrains Mono, each under the SIL Open Font License, kept in `fonts/` with their licenses.

## License

MIT. See `LICENSE`. The fonts keep their own licenses.
