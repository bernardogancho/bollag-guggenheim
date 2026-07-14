const fs = require('fs');
const path = require('path');

// Emits /admin/media-index.json at build time: every file under
// src/assets/media, for the admin's media library. Video files (mp4/webm)
// are included DELIBERATELY — hero sections use video, picked via the
// same picker with kind="file".
module.exports = class MediaIndex {
  data() {
    return { permalink: '/admin/media-index.json', eleventyExcludeFromCollections: true };
  }

  render() {
    const root = path.join('src', 'assets', 'media');
    const files = [];
    const walk = dir => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.(avif|gif|jpe?g|png|svg|webp|mp4|webm)$/i.test(entry.name)) {
          files.push({
            path: `/${path.relative('src', full).split(path.sep).join('/')}`,
            name: entry.name,
            size: fs.statSync(full).size,
          });
        }
      }
    };
    walk(root);
    files.sort((a, b) => a.path.localeCompare(b.path));
    return JSON.stringify({ generatedAt: new Date().toISOString(), files });
  }
};
