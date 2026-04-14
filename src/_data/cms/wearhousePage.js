const hero = require("./wearhousePage/hero.json");
const overview = require("./wearhousePage/overview.json");
const roster = require("./wearhousePage/roster.json");
const showroom = require("./wearhousePage/showroom.json");
const cta = require("./wearhousePage/cta.json");
const detail = require("./wearhousePage/detail.json");
const contact = require("./wearhousePage/contact.json");
const brands = require("./wearhousePage/brands.json");

module.exports = {
  ...hero,
  ...overview,
  ...roster,
  ...showroom,
  ...cta,
  ...detail,
  ...contact,
  ...brands
};
