const pageContent = require("./cms/wearhousePage");
const rosterItems = (pageContent.rosterSection && pageContent.rosterSection.items) || [];
const detailBrandsBySlug = new Map((pageContent.brands || []).map((brand) => [brand.slug, brand]));

const createWearhouseLogoSvg = (brand) => {
  const lines = brand.logoLines || [brand.name];
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
  const fontSize = brand.logoFontSize || (longest > 14 ? 38 : longest > 10 ? 44 : 52);
  const lineHeight = Math.round(fontSize * 1.02);
  const width = 720;
  const paddingX = 36;
  const height = Math.max(160, 56 + (lines.length * lineHeight));
  const startY = lines.length === 1
    ? Math.round(height / 2 + fontSize * 0.26)
    : Math.round((height - (lines.length * lineHeight)) / 2 + fontSize);

  const text = lines.map((line, index) => {
    const y = startY + (index * lineHeight);
    return `<text x="50%" y="${y}" text-anchor="middle">${line}</text>`;
  }).join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${brand.name}"><style>text{fill:#111111;font-family:'Helvetica Neue',Arial,sans-serif;font-size:${fontSize}px;font-weight:400;letter-spacing:-0.04em;text-transform:uppercase}<\/style>${text}</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

module.exports = {
  ...pageContent,
  brands: rosterItems.map((brand) => {
    const detailBrand = detailBrandsBySlug.get(brand.slug) || {};
    const detail = detailBrand.detail || {};
    const merged = {
      ...detailBrand,
      ...brand,
      ...detail,
      eyebrow: pageContent.detailPage.heroEyebrow,
      pageHref: brand.pageHref || `/wearhouse/${brand.slug}/`,
      logoSvg: createWearhouseLogoSvg({ name: brand.name, logoLines: brand.logoLines || detailBrand.logoLines }),
      detailHeroImage: detailBrand.detailImage || brand.detailImage || brand.hoverImage || null,
      detailGallery: [detailBrand.detailImage, brand.hoverImage]
      .filter(Boolean)
      .filter((image, index, images) => images.indexOf(image) === index)
      .map((image, index) => ({
        image,
        note: `${brand.name} image ${index + 1}`
      })),
      officialHref: detailBrand.websiteHref || brand.websiteHref
    };

    return merged;
  })
};
