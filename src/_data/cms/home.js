const hero = require("./home/hero.json");
const intro = require("./home/intro.json");
const brandsWall = require("./home/brandsWall.json");
const wearhouseWall = require("./home/wearhouseWall.json");
const selectionSection = require("./home/selectionSection.json");

module.exports = {
  ...hero,
  ...intro,
  ...brandsWall,
  ...wearhouseWall,
  ...selectionSection
};
