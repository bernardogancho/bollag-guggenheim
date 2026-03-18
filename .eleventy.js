module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets/media": "assets/media" });
  eleventyConfig.addPassthroughCopy({ "src/assets/scripts": "assets/scripts" });

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
