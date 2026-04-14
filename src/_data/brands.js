const brandsPage = require("./cms/brandsPage");

module.exports = brandsPage.brands.map((brand) => ({
  ...brand,
  ...(brand.card || {}),
  ...(brand.detail || {}),
  href: `/brands/${brand.slug}/`
}));
