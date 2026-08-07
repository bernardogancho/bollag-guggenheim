module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets/media": "assets/media" });
  eleventyConfig.addPassthroughCopy({ "src/assets/documents": "assets/documents" });
  eleventyConfig.addPassthroughCopy({ "src/assets/scripts": "assets/scripts" });
  eleventyConfig.addPassthroughCopy({ "src/admin/config.yml": "admin/config.yml" });
  eleventyConfig.addPassthroughCopy({ "src/_data/cms": "cms-data" });
  eleventyConfig.addPassthroughCopy({ "src/.htaccess": ".htaccess" });
  eleventyConfig.addPassthroughCopy({ "src/favicon.ico": "favicon.ico" });
  eleventyConfig.addPassthroughCopy({ "src/apple-touch-icon.png": "apple-touch-icon.png" });

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
