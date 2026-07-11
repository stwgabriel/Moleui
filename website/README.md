# Moleui Landing Page

A fully animated, single-file marketing landing page for Moleui Desktop. Version 2 is a cinematic scroll journey: it opens in deep space (parallax starfield canvas, brand-colored nebulas, shooting stars, an astronaut mole), floats the app's feature scenes through the cosmos as glowing glass windows, and descends into a dawn field (sunrise, drifting clouds, fireflies, the mole on his molehill) for the closing "you can breathe" download moment.

Built with the app's own design system: DM Sans, purple `#8c3ffc` and pink `#fd2d86` accents, glassmorphism, and the per-feature color wheel (My Mac green, Cleanup blue, Optimize purple, Uninstall red, Storage pink).

## Files

- `index.html` - the deployable page (v2). Self-contained except for DM Sans from Google Fonts. Drop it on any static host.
- `index.template.html` - v2 skeleton: cosmos backdrop layers, starfield canvas, nav, space hero, stat strip, dawn-field finale (healing dashboard demo, FAQ, download CTA, footer), and the shared reveal/counter/parallax JS framework.
- `sections/*.html` - one fragment per feature section (clean, optimize, uninstall, analyze, mymac, safety). Each contains its own scoped `<style>` and `<script>`.
- `build.py` - assembles `index.html` by replacing `<!-- @@SECTION:name@@ -->` markers in the template with fragment contents.
- `v1.html` / `v1.template.html` - the archived first version (light glassmorphism, no cosmos).
- `assets/mole-mascot.svg` - the mole mascot source.

## Editing

Edit the template or a section fragment, then rebuild:

```bash
python3 build.py
```

Preview locally:

```bash
python3 -m http.server 4173 --directory .
```

## Quality notes (from the multi-agent audit)

- Animations start on visibility and every loop idles when its section is off-screen or the tab is hidden.
- `prefers-reduced-motion` renders static end-states everywhere, including a static starfield.
- The animated dashboard windows avoid `backdrop-filter` (animated backdrop sampling was the worst GPU cost); decorative mockups are `role="img"` with labels and hidden internals.
- Copy rules: no emoji, no em dashes. Pricing is stated honestly: free download, free My Mac monitoring, Cleanup/Optimize/Uninstall/Storage under Moleui Pro (tagged on their sections and in the FAQ).
