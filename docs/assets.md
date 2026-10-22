# Visual assets

These assets support a local Pet Corner demonstration storefront. The product illustrations are generic demo placeholders, not photographs of actual merchant inventory.

| Asset | Source and treatment | Dimensions |
| --- | --- | --- |
| `public/images/hero-pets.webp` | AI-generated editorial pet photograph using the built-in image_gen tool; exported to WebP with Sharp at quality 85 | 1536 × 1024 |
| `public/images/logo.webp` | User-supplied `../logo/logo.png`; white outer margin trimmed and resized with Sharp. Artwork was not redrawn or recolored. | 160 × 180 |
| `public/images/product-food.svg` | Original code-native SVG illustration of generic ivory cat-food packaging | 640 × 640 |
| `public/images/product-bowl.svg` | Original code-native SVG illustration of a navy ceramic pet bowl | 640 × 640 |
| `public/images/product-toy.svg` | Original code-native SVG illustration of a sage ball and terracotta rope toy | 640 × 640 |
| `public/images/product-care.svg` | Original code-native SVG illustration of a cream/blue grooming bottle and brush | 640 × 640 |

## Hero generation

Mode: built-in image_gen, no CLI or external API key.

Selected original was retained at:

`C:\Users\saads\.codex\generated_images\01a15ebf-f4d8-7d23-9eab-41bae5bdf158\exec-77d046bd-1dbc-41e3-8f0b-1952b42e28ab.png`

Final prompt:

```text
Use case: photorealistic-natural
Asset type: premium pet shop website hero photograph
Primary request: A friendly golden retriever and a calm gray-brown tabby cat seated comfortably together, close together and gently attentive to the camera.
Scene/backdrop: warm natural cream seamless studio backdrop and floor.
Style/medium: polished real editorial animal photography with lifelike detailed fur, natural proportions and an inviting, quiet mood.
Composition/framing: landscape photograph, eye-level camera, both animals centered together as a group and occupying most of the frame. Show complete seated bodies including paws, with a little space above their heads and around their bodies. Retriever on the left, cat on the right, with the cat clearly visible.
Lighting/mood: soft large-window studio lighting, warm cream tones, natural gentle shadows, premium understated finish.
Constraints: exactly one dog and one cat, anatomically correct paws, realistic eyes and fur; no collars, clothing, props, products, text, logos or watermark.
```

The image was visually checked for clear pet faces, realistic fur, complete seated bodies and paws, and absence of text or product props. The final WebP is approximately 112 KB. The original output is a generated scene; it does not document actual pets or a merchant location.

## Product illustration direction

The SVGs use the logo's navy `#103f6b` and blue `#2c75c8`, with warm ivory, sage, terracotta and light neutral card backgrounds. They contain no brand names, reviews, certification marks or unsupported product claims. Food and grooming packaging use abstract label marks rather than real merchant copy.

Suggested alt text:

- Hero: “A golden retriever and a tabby cat sitting together.”
- Food: “Illustrated ivory cat-food bag with a blue label.”
- Bowl: “Illustrated navy ceramic pet bowl.”
- Toy: “Illustrated sage ball and terracotta rope toy.”
- Care: “Illustrated grooming bottle and wooden pet brush.”

## Validation and replacement guidance

All SVGs were successfully parsed and rendered with Sharp, then visually checked together at 320 × 320 pixels. The optimized logo was visually checked against the supplied artwork. The logo retains its white background and original aspect ratio after trimming.

Replace generic product illustrations with verified merchant inventory photography before treating this demo as a live product catalog. No claims are made about product packaging, stock, ingredients or manufacturer identity. No separate dog/cat category photos were generated; the hero can also be cropped for category cards.

## Transparent logo upgrade — 2026-10-22

The current storefront, pre-React splash and independent admin use `public/images/logo-original.png`, copied byte-for-byte from the supplied `../logo/logo-removebg-preview.png` (500 × 500 RGBA). The original artwork and transparency are preserved; no generation, recoloring or redrawing was used. The older white-background logo.webp is retained for historical compatibility but is no longer the primary displayed mark.

`public/favicon-32.png`, `favicon-192.png` and `favicon-180.png` are trimmed/contained PNG derivatives of those same supplied pixels with transparent padding. The admin contains copies of the original mark and icons (180px as apple-touch-icon.png). Favicon links are present in both independent HTML documents.

Category imagery uses existing category pictures or crops of the existing generated hero. Commercial product photos must come from the merchant through the real upload flow. Production catalog filtering excludes seeded demo products.
