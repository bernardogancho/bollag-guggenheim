module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets/media": "assets/media" });
  eleventyConfig.addPassthroughCopy({ "src/assets/scripts": "assets/scripts" });
  eleventyConfig.addPassthroughCopy({ "src/admin": "admin" });
  eleventyConfig.addPassthroughCopy({ "src/_data/cms": "cms-data" });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      output: "_site"
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk"
  };
};
