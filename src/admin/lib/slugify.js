// Turns a display name into a URL slug: lowercase, runs of anything that is
// not a letter or digit collapse to single hyphens, no leading/trailing
// hyphens. Shared by the Wearhouse and BG brand editors.
export const slugify = value => String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
