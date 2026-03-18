# Fashion Landing Header + Hero Design

**Goal:** Define the first approved slice of the fashion landing page: a severe, editorial header and immersive hero built for brand/story awareness.

## Approved Direction

- Visual tone: bold and severe
- Palette: monochrome UI
- Page intent: brand/story awareness, not ecommerce-first
- Composition: balanced between photography and typography
- Hero media: large photography dominates above the fold
- Header: logo left, navigation right
- Hero lockup: centered at the bottom using `hero.svg`

## Section Structure

### Header

- Position: absolute over the hero
- Left: `logo.svg`
- Right: `Company`, `Brands`, `Stores`, `Contact`
- Style: lightweight uppercase navigation with wide tracking
- Behavior: transparent over image, darkens slightly on scroll via JS

### Hero

- Height: minimum `100svh`
- Background: full-bleed campaign image
- Overlay: subtle dark gradient for readability only
- Bottom content: `hero.svg`, centered horizontally
- Copy: no additional headline for now because the SVG lockup already carries the opening statement

## Design Principles

- Keep the chrome restrained so the image feels dominant
- Use hard spacing and sharp alignment instead of decorative styling
- Avoid soft luxury cues; the page should feel colder and more editorial
- Preserve reuse by separating layout, header, and hero into Eleventy components

## Asset Assumptions

- `logo.svg` is used as the navigation brand mark
- `hero.svg` is used as the opening lockup
- The immersive hero image still needs to be added to the project as a local asset

## Open Follow-Up

- Replace the temporary hero background with the final uploaded home-page photo when provided as a file
