---
name: distinctive-web-design
description: Design and build websites and web pages that look crafted for their subject, never like generic AI ("vibe-coded") output. Use whenever you build, redesign, restyle or review a website, landing page or web app screen, and whenever the user shares design examples, screenshots or links to follow. Covers color (no default purple), beautiful typography, layout, imagery, copy, desktop and mobile, and a required self-check in a real browser before you say you're done.
---

# Distinctive web design

Build the site a good studio would ship for *this* client: it looks like it could only belong to them. If you could swap the logo onto a different company's site and nobody would notice, it's generic. Start over.

Work through the five steps in order: **References → Direction → Build → Check → Report.** Don't skip the check.

---

## 1. References come first

If the user gives examples (screenshots, links, a site they like, a brand guide), they outrank every default in this file.

1. **Study each example and write a reference card** before writing any code:
   ```
   Reference: <name or "screenshot 1">
   Colors:      background ___, text ___, accent ___, how much accent ___%
   Typography:  heading font/style ___, body ___, sizes, weights, letter-spacing
   Layout:      alignment, grid, density, how sections are separated, image sizes
   Details:     corners (sharp/soft), borders vs shadows, buttons, icons, motion
   Mood:        three words
   Take:        what to borrow
   Don't take:  what not to borrow (their logo, text, photos, signature effect)
   ```
2. **Borrow the system, not the content.** Match the palette logic, type feel, spacing, layout rhythm and level of polish. Never copy their logo, copy, photos, illustrations or code.
3. **If examples disagree,** follow the one closest to the user's brief and say which you chose.
4. **If an example contains something this file bans** (say, purple), follow the user. They chose it deliberately.
5. **No examples?** Find two or three real, well-designed sites in the same field (a bakery's site for a bakery, a fintech app for a fintech app) and write reference cards for those.

---

## 2. What vibe-coded sites look like (never do these)

These are the tells of default AI output. Any one of them makes a site look generic; together they make it look like every other site.

**Color**
- Purple, violet or lavender as the main color, or purple-to-pink / purple-to-blue gradients
- A dark navy or black page with a glowing colored blob behind the headline
- Neon gradient text, rainbow gradients, gradient buttons
- Glassmorphism (frosted cards), heavy glows, colored drop shadows

**Layout**
- The template skeleton: centered hero → pill badge → slogan → two buttons → three stat numbers → "Features" heading → three icon cards in a row → testimonials → pricing → FAQ → footer
- Everything centered on the page axis
- Identical cards repeated in every section; every section the same height and structure
- A big empty "product screenshot" frame with nothing real in it

**Decoration**
- Floating 3D blobs, spheres, glossy ribbons, abstract shapes with no meaning
- Dot grids and noise added "for texture" everywhere
- Icons in colored circles above every card; emoji in headings

**Words**
- Vague slogans: "Build better products, faster", "The future of ___ is here", "Unlock your potential", "Supercharge your workflow", "Seamless", "Next-generation", "Revolutionizing"
- Invented statistics ("95% faster", "10k+ happy users") and fake testimonials
- Buttons that say "Learn more", "Get started", "Explore", "Discover"

**Type**
- Inter, Roboto, Arial, Helvetica, Open Sans, Lato, Montserrat or Poppins as the display font, or the browser default
- Headlines in bold 700–900 everywhere; tiny gray body text

---

## 3. Direction: decide before you build

Write this down (in your plan, not on the page):

```
Subject:   what it is, who it's for, the one thing a visitor should do
Mood:      three words that fit the subject (e.g. "warm, crafted, local")
Palette:   colors, and where each comes from
Fonts:     display + text pairing, and why it fits
Layout:    section list, what's in each, and how they differ from each other
Imagery:   what real pictures or real UI each section shows
```

### Color: from the subject, not from habit
- **Take colors from the real thing:** the product, the place, the brand, the photographs (a bakery's terracotta and flour, a marine lab's deep teal, a law firm's ink and paper).
- **Mostly neutral:** 85–95% of the screen is neutrals. Tint them slightly toward the accent: warm off-white, cool gray, ink instead of pure black (`#1f2a2e`, not `#000`).
- **One accent color,** used for the main button, links, focus rings and small highlights. At most one secondary.
- **Contrast:** body text at least 7:1 against its background, secondary text at least 4.5:1, large text and buttons at least 3:1 (WCAG).
- **No purple or violet** (hue roughly 260°–330°) unless the brand or the user asks for it.
- **Dark mode / dark pages** only when the subject calls for it (developer tools, film, nightlife). If you do, lift surfaces with lighter grays, not glows.
- Define colors once as CSS variables (`--bg`, `--surface`, `--ink`, `--muted`, `--accent`, `--line`) and use only those.

### Typography: always a beautiful font
Typography is the fastest way to look designed. Pick a pairing that fits the mood: one display face for headlines, one text face for body (they can be the same family). At most two families and four font files.

| Mood | Display (headlines) | Text (body) |
|---|---|---|
| Editorial, elegant | Fraunces, Playfair Display, Instrument Serif, Newsreader | Source Serif 4, Literata, or a clean sans (Figtree) |
| Warm, friendly, local | Recoleta*, Gloock, DM Serif Display, Young Serif | DM Sans, Figtree, Nunito Sans |
| Modern, confident product | Mona Sans, Hanken Grotesk, Schibsted Grotesk, Bricolage Grotesque | Geist, Instrument Sans, Public Sans |
| Technical, precise | Space Grotesk (sparingly), JetBrains Mono for labels | IBM Plex Sans, Geist |
| Bold, sporty, energetic | Archivo (expanded), Big Shoulders Display, Anton (one word only) | Archivo, Barlow |
| Luxury, calm | Cormorant Garamond, Italiana | Manrope, Jost |

\* Recoleta is commercial. Everything else listed is free on Google Fonts or Fontsource.

**Type rules:**
- Load fonts properly (Google Fonts with `display=swap`, or self-host with Fontsource). Make sure they actually load (see the check).
- **Big, well-set headlines:** the hero at about 56–88px desktop and 36–48px mobile, using `clamp()`. Weight 400–600 (not 800 for everything). Tighten letter-spacing as size grows (-1% to -4%).
- **Body text:** 16–18px, line-height 1.5–1.7, line length 50–75 characters (`max-width: 65ch`), in the ink color, not light gray.
- **A clear scale:** each level about 1.25–1.5× the next. One size per kind of element across the whole site.
- Sentence case. No ALL CAPS paragraphs. Use real typographic characters: curly quotes “ ”, apostrophes ’, en dashes –.

### Layout: designed, not templated
- **Choose the hero** from the content: a large real photograph with the words beside or below it, a split (text left, real product right), or an editorial headline set very large. Avoid the centered-slogan-and-two-buttons hero unless a reference uses it.
- **Left-align** most text on a 12-column grid with equal left and right page margins. Centered text only for short lines.
- **Vary sections:** a split, then a full-width image, then a list, then a quote with a real photo, and so on. No two neighboring sections share a layout.
- **Separate sections** by space or a change of background color, not lines and shadows everywhere.
- **Generous whitespace:** sections 96–160px apart on desktop, 64–96px on mobile. Use one spacing scale (4, 8, 12, 16, 24, 32, 48, 64, 96, 128).
- **One button style** (primary filled + one secondary), one card style, one corner radius family.

### Imagery: the real thing
- Show the actual product, place, people or work: real photos, real screenshots, real UI built in HTML. Every section should have something real to look at.
- No photos yet? Use clearly temporary, high-quality, properly licensed stand-ins of the *same kind of thing* (Unsplash, Pexels), list them for the user to replace, and never pass them off as the client's.
- Icons: one consistent set (Lucide, Phosphor, Tabler) at one stroke weight, used sparingly, never inside colored circles by default. A real product's logo keeps its real colors.

### Words: specific, plain, true
- **The headline says what it is and for whom:** "Sourdough bakery on Mill Street, open from 7", not "Taste the difference".
- **Include one concrete fact** on the first screen: a number, a place, a price, a date.
- **Buttons are a verb plus a thing:** "Book a table", "Start a free trial", "See the menu".
- **Never invent** statistics, reviews, customer logos or awards. No proof yet? Leave it out.

### Motion: quiet
- Hover: buttons lift 1px, linked cards lift 2px, images zoom 2–3%. Transitions 150–200ms.
- One small entrance animation for the hero is fine. No fade-in on every section, no parallax text, no scroll-jacking.
- Respect `prefers-reduced-motion`.

---

## 4. Build for desktop and mobile

Build mobile-first, then enhance for larger screens. It must look *designed* at every size, not just "not broken".

- **Widths to support:** 360, 390, 768, 1024, 1280 and 1440px, plus anything in between.
- **No sideways scrolling at any width:** use `min-width: 0` on flex/grid children, `max-width: 100%` on media, and `overflow-wrap: anywhere` on long words and URLs.
- **Fluid type and spacing** with `clamp()`. Text never smaller than 14px; body 16px+ on phones (prevents iOS zoom on inputs).
- **Tap targets at least 44×44px,** with at least 8px between them.
- **Navigation:** a full bar on desktop; on phones the logo plus a menu button that opens a full-screen or sheet menu. The main action stays reachable.
- **Grids collapse sensibly:** 3–4 columns → 2 on tablet → 1 on phone. Splits stack text first, then the image.
- **Images:** `srcset`/`sizes` or responsive `<picture>`, `loading="lazy"` below the first screen, explicit `width`/`height` (or `aspect-ratio`) to avoid layout shift. Crop for the phone when the subject would be lost.
- **Viewport:** `<meta name="viewport" content="width=device-width, initial-scale=1">`, and `100svh`/`100dvh` instead of `100vh` for full-height sections.
- **Basics:** semantic HTML (`header`, `nav`, `main`, `section`, `footer`), one `h1`, headings in order, alt text on content images, visible focus styles, and a `<title>` and meta description.

---

## 5. Check your work (required)

You're not done until you've seen the site in a real browser and fixed what you found. "It compiles" is not a check.

### 5a. Look at it
Open the page in a headless browser (Playwright, or Puppeteer with `--headless --no-sandbox`) and take screenshots at **390×844 (phone), 768×1024 (tablet) and 1440×900 (desktop)**, full page. Then actually look at every screenshot.

### 5b. Run the automatic checks
Save this as `check-design.mjs` and run `node check-design.mjs http://localhost:5173/`. It needs Playwright (`npm i -D playwright`, then `npx playwright install chromium` if no browser is installed).

```js
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://localhost:5173/';
const sizes = [[390, 844, 'phone'], [768, 1024, 'tablet'], [1440, 900, 'desktop']];
const BANNED_FONTS = /^(inter|roboto|arial|helvetica|open sans|lato|montserrat|poppins|system-ui|-apple-system|sans-serif|serif)$/i;
const browser = await chromium.launch();
let problems = 0;
for (const [w, h, name] of sizes) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `check-${name}.png`, fullPage: true });
  const r = await page.evaluate((bannedSrc) => {
    const banned = new RegExp(bannedSrc, 'i');
    const out = { overflow: document.documentElement.scrollWidth - innerWidth, offscreen: [], fonts: new Set(), purple: [], smallTaps: [], tinyTaps: [], tinyText: [] };
    const hue = (c) => { const m = c.match(/\d+(\.\d+)?/g); if (!m) return null; const [r, g, b] = m.slice(0, 3).map(Number); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx - mn < 25) return null; let h = mx === r ? (g - b) / (mx - mn) : mx === g ? 2 + (b - r) / (mx - mn) : 4 + (r - g) / (mx - mn); h = (h * 60 + 360) % 360; return h; };
    // skip what nobody sees or can use: hidden, decorative, and drawn pictures of UI (role="img")
    const hidden = (el, cs, box) => box.width <= 1 || box.height <= 1 || cs.visibility === 'hidden' || +cs.opacity === 0 || (cs.clipPath && cs.clipPath !== 'none') || (el.matches('a[href^="#"]') && /skip/i.test(el.className + el.textContent) && document.activeElement !== el) || box.bottom < 0 || box.right < 0 || box.left >= innerWidth || el.closest('[aria-hidden="true"], [role="img"], [inert], .sr-only, .visually-hidden') || (cs.position === 'absolute' && cs.clip !== 'auto');
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el), box = el.getBoundingClientRect();
      if (hidden(el, cs, box)) continue;
      if (box.right > innerWidth + 1 && cs.position !== 'fixed' && !el.closest('[style*="overflow"], .scroll-x, [data-scroll]')) out.offscreen.push(el.tagName + '.' + String(el.className).slice(0, 40));
      if (/^H[1-3]$/.test(el.tagName)) out.fonts.add(cs.fontFamily.split(',')[0].replace(/["']/g, '').trim());
      for (const c of [cs.color, cs.backgroundColor, cs.borderTopColor]) { const h = hue(c); if (h !== null && h >= 260 && h <= 330) { out.purple.push(el.tagName + ' ' + c); break; } }
      if (cs.backgroundImage.includes('gradient') && /rgb/.test(cs.backgroundImage)) { const hs = cs.backgroundImage.match(/rgba?\([^)]+\)/g)?.map(hue).filter((x) => x !== null) ?? []; if (hs.some((x) => x >= 260 && x <= 330)) out.purple.push(el.tagName + ' gradient'); }
      // links inside sentences are exempt; everything else tappable should be 44px (24px is the WCAG 2.2 minimum)
      const inText = cs.display === 'inline' && el.closest('p, li');
      if (el.matches('a, button, input, select, textarea, [role=button]') && !inText && (box.height < 44 || box.width < 44)) (box.height < 24 || box.width < 24 ? out.tinyTaps : out.smallTaps).push((el.innerText || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 30));
      if (el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(cs.fontSize) < 14) out.tinyText.push(el.innerText.slice(0, 30));
    }
    const fonts = [...out.fonts];
    return { ...out, fonts, bannedHeadingFonts: fonts.filter((f) => banned.test(f)), loaded: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family) };
  }, BANNED_FONTS.source);
  const report = {
    'sideways scroll (px)': r.overflow,
    'elements past right edge': r.offscreen.slice(0, 5),
    'heading fonts': r.fonts,
    'generic heading fonts': r.bannedHeadingFonts,
    'web fonts loaded': [...new Set(r.loaded)],
    'purple/violet colors': r.purple.slice(0, 5),
    'tap targets under 24px (fix)': w < 1024 ? r.tinyTaps.slice(0, 8) : '(desktop: n/a)',
    'tap targets 24–43px (aim for 44)': w < 1024 ? r.smallTaps.slice(0, 8) : '(desktop: n/a)',
    'text under 14px': r.tinyText.slice(0, 5),
    'script errors': errors,
  };
  const bad = r.overflow > 0 || r.offscreen.length || r.bannedHeadingFonts.length || !r.loaded.length || r.purple.length || (w < 1024 && r.tinyTaps.length) || r.tinyText.length || errors.length;
  if (bad) problems++;
  console.log(`\n== ${name} ${w}x${h} ${bad ? 'NEEDS FIXES' : 'ok'}`);
  for (const [k, v] of Object.entries(report)) console.log(`  ${k}:`, Array.isArray(v) ? (v.length ? v : 'none') : v);
  await page.close();
}
await browser.close();
console.log(problems ? `\n${problems} size(s) need fixes. Look at check-*.png too.` : '\nAll automatic checks passed. Now look at check-*.png.');
process.exit(problems ? 1 : 0);
```

Purple that the brand or user asked for is fine; note it and move on. Tap targets between 24 and 43px are reported, not failed: make the main buttons and menu 44px, and use judgment for the rest. Text inside a picture of UI (`role="img"`) is skipped, since it's part of an illustration.

### 5c. The eye test (go through every screenshot)
- [ ] **Swap test:** with another company's logo, would this still look right? If yes, it's too generic. Push the palette, type and imagery toward the subject.
- [ ] **No tells** from section 2 anywhere (purple, glow blobs, template skeleton, fake stats, filler words, default fonts).
- [ ] **The first screen** says what this is and for whom, has one concrete fact, and its main button is visible without scrolling, on the phone too.
- [ ] **Typography** looks intentional: the display font is clearly visible in the headlines, the scale is consistent and lines aren't too long.
- [ ] **Every section shows something real** (a photo, UI, product), and neighboring sections look different.
- [ ] **Alignment:** left edges line up down the page, nothing is cut off, overlapping or squeezed.
- [ ] **Phone screenshot:** comfortable text size, nothing cramped, buttons easy to tap, the menu works.
- [ ] **Matches the references:** put your screenshot next to each reference. Does it share their polish, spacing and type feel?
- [ ] **Contrast** is readable everywhere, including text over images.

### 5d. Fix and repeat
Fix every problem, then run 5a–5c again. Repeat until everything passes, up to three rounds. If something still fails after that, say so plainly in the report instead of hiding it.

---

## 6. Report

Finish with a short summary for the user:
- the direction (mood, palette and where it came from, font pairing)
- which references you followed and what you took from each
- the check results at each size, and anything still open
- every stand-in image or placeholder they need to replace with real material
- the screenshots (phone and desktop), so they can see it without running anything
