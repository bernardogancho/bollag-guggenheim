const pageContent = require("./cms/wearhousePage");
const rosterItems = (pageContent.rosterSection && pageContent.rosterSection.items) || [];
const detailBrandsBySlug = new Map((pageContent.brands || []).map((brand) => [brand.slug, brand]));

const createWearhouseLogoSvg = (brand) => {
  const lines = brand.logoLines || [brand.name];
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
  const fontSize = brand.logoFontSize || (longest > 14 ? 38 : longest > 10 ? 44 : 52);
  const lineHeight = Math.round(fontSize * 0.98);
  const paddingX = 18;
  const paddingY = 10;
  const width = Math.max(220, Math.round((paddingX * 2) + longest * fontSize * 0.64));
  const height = Math.round((lines.length * lineHeight) + (paddingY * 2));
  const startY = Math.round(paddingY + fontSize * 0.82);

  const text = lines.map((line, index) => {
    const y = startY + (index * lineHeight);
    return `<text x="${paddingX}" y="${y}">${line}</text>`;
  }).join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${brand.name}"><style>text{fill:#111111;font-family:'Helvetica Neue',Arial,sans-serif;font-size:${fontSize}px;font-weight:500;letter-spacing:-0.04em;text-transform:uppercase}<\/style>${text}</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const brands = rosterItems.map((brand) => {
    const detailBrand = detailBrandsBySlug.get(brand.slug) || {};
    const rosterCard = detailBrand.rosterCard || {};
    const detail = detailBrand.detail || {};
    const merged = {
      ...detailBrand,
      ...brand,
      ...detail,
      pageHref: brand.pageHref || `/wearhouse/${brand.slug}/`,
      logoSvg: createWearhouseLogoSvg({ name: brand.name, logoLines: brand.logoLines || detailBrand.logoLines || rosterCard.logoLines }),
      detailHeroImage: detailBrand.detailImage || brand.detailImage || brand.hoverImage || null,
      detailPortraitImage: brand.portraitImage || brand.detailImage || brand.hoverImage || null,
      detailGallery: (brand.gallery && brand.gallery.length)
        ? brand.gallery
        : [detailBrand.detailImage, brand.hoverImage]
          .filter(Boolean)
          .filter((image, index, images) => images.indexOf(image) === index)
          .map((image, index) => ({
            image,
            note: `${brand.name} image ${index + 1}`
          })),
      officialHref: detailBrand.websiteHref || brand.websiteHref
    };

    return merged;
});

// The homepage Wearhouse wall shows a brand's page hero on hover, so it reads
// the same value the brand page itself renders. Keyed by slug because the wall
// stores only a link (/wearhouse/<slug>/), and kept as derived data so changing
// a hero in the CMS updates the homepage with no second edit.
const heroBySlug = {};
for (const brand of brands) {
  if (brand.slug && brand.detailHeroImage) {
    heroBySlug[brand.slug] = brand.detailHeroImage;
  }
}

module.exports = {
  ...pageContent,
  brands,
  heroBySlug
};
