const hero = require("./brandsPage/hero.json");
const portfolio = require("./brandsPage/portfolio.json");
const detail = require("./brandsPage/detail.json");
const brands = require("./brandsPage/brands.json");

module.exports = {
  ...hero,
  ...portfolio,
  ...detail,
  ...brands
};
