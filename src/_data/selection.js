const brands = require("./brands");
const brandPageMedia = require("./brandPageMedia");
const brandFeed = require("./brandFeed");

const itemsPerBrand = 2;
const sizePattern = ["wide", "standard", "tall", "standard", "standard", "wide", "standard", "tall"];

const brandPools = brands.map((brand) => {
  const pageGallery = (brandPageMedia[brand.slug]?.gallery || []).map((item) => item.image);
  const feedGallery = (brandFeed[brand.slug]?.gallery || []).map((item) => item.image);
  const pool = [...pageGallery, ...feedGallery];

  return {
    brand: brand.name,
    href: `/brands/${brand.slug}/`,
    images: pool.slice(0, itemsPerBrand)
  };
});

const selection = [];

for (let imageIndex = 0; imageIndex < itemsPerBrand; imageIndex += 1) {
  for (const brand of brandPools) {
    const image = brand.images[imageIndex];

    if (!image) {
      continue;
    }

    const itemIndex = selection.length;

    selection.push({
      brand: brand.brand,
      image,
      href: brand.href,
      note: `${brand.brand} editorial selection`,
      size: sizePattern[itemIndex % sizePattern.length]
    });
  }
}

module.exports = selection;
