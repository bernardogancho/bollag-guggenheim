const brands = require("./brands");
const selection = require("./selection");
const brandFeed = require("./brandFeed");
const brandPageMedia = require("./brandPageMedia");

const editorialCopy = {
  "closed": {
    eyebrow: "Modern Essentials",
    heroTitle: "Made with Love",
    summary: "European denim and wardrobe foundations shaped through French vision, Italian making, and German precision.",
    intro: "Closed began as one of the first Italian denim labels before evolving into a wider premium wardrobe brand headquartered in Hamburg. Its identity still turns on denim, but the proposition is broader: precise essentials, measured luxury, and clothing that avoids excess.",
    focus: "The brand’s strength comes from long-standing Italian production partnerships, deep material knowledge, and a confidence that does not need theatrical branding to register. It reads as premium through cut, fabric, and restraint.",
    atmosphere: "Restrained, tactile, exacting.",
    categories: ["Denim", "Tailoring", "Wardrobe Foundations"],
    tone: "A quiet luxury language built around material confidence and enduring fit."
  },
  "coccinelle": {
    eyebrow: "Leather Goods",
    heroTitle: "An all Italian Story",
    summary: "Italian leather accessories with urban elegance, refined craftsmanship, and globally legible polish.",
    intro: "Founded near Parma in 1978, Coccinelle has built a clear position in handbags, small leather goods, and accessories through accessible luxury and distinctly Italian refinement.",
    focus: "Its appeal lies in balancing elegance with usability: original Italian craftsmanship, polished silhouettes, and an urban femininity that feels premium without feeling distant.",
    atmosphere: "Refined, polished, metropolitan.",
    categories: ["Handbags", "Small Leather Goods", "Accessories"],
    tone: "A leather-led brand language that turns craftsmanship into everyday desirability."
  },
  "codello": {
    eyebrow: "Accessory Color",
    heroTitle: "Accessories that makes people happy.",
    summary: "Scarves and accessories driven by print, color, craft, and a long-standing signature in silk.",
    intro: "Codello grew from a single silk scarf idea into a broad accessories brand with a recognisable visual signature. Material, color, and pattern remain central to the label’s identity, as does a persistent attention to craft and detail.",
    focus: "What distinguishes Codello is not minimalism but expression: scarves and accessories designed to add personality, movement, and graphic energy while maintaining quality and brand recognisability.",
    atmosphere: "Expressive, graphic, uplifting.",
    categories: ["Scarves", "Accessories", "Print-led Capsules"],
    tone: "An accessory system built to inject character rather than simply complete a look."
  },
  "drykorn": {
    eyebrow: "Contemporary Tailoring",
    heroTitle: "For Beautiful People",
    summary: "Sharper silhouettes and modern tailoring for independent dressers with a metropolitan point of view.",
    intro: "Drykorn began with a simple proposition: fashionable trousers at accessible prices. From that focused start, it expanded into an international label defined by contemporary tailoring, urban clarity, and a more self-possessed kind of dressing.",
    focus: "The brand speaks to confident individualists. Its campaigns, cuts, and proportions all work in the same direction: recognisable shape, strong styling, and fashion that feels progressive while remaining wearable.",
    atmosphere: "Urban, assertive, directional.",
    categories: ["Tailoring", "Trousers", "Modern Separates"],
    tone: "A sharper editorial voice carried through fit, attitude, and metropolitan precision."
  },
  "g-lab": {
    eyebrow: "Performance Outerwear",
    heroTitle: "Always in Your Element",
    summary: "Technical outerwear that bridges functional protection with a cleaner contemporary fashion sensibility.",
    intro: "Founded in Düsseldorf in 2009 by Björn Gericke, g-lab was built around one premise: outerwear should perform at a high level without sacrificing design. The result is a brand that moves between weather protection and fashion clarity with unusual ease.",
    focus: "Its value inside the portfolio is distinct. G-lab occupies the space where technical knowledge, modern silhouette, and day-to-day wearability meet, making it relevant to customers who expect performance without visual compromise.",
    atmosphere: "Functional, contemporary, precise.",
    categories: ["Outerwear", "Technical Jackets", "Performance Lifestyle"],
    tone: "A performance-led brand made credible through understatement rather than noise."
  },
  "guess": {
    eyebrow: "Global Lifestyle",
    heroTitle: "The Essence of Sexyness",
    summary: "A globally recognised lifestyle label combining denim heritage, accessories, and a more overt sense of fashion image-making.",
    intro: "Founded in California in 1981 by the Marciano brothers, GUESS quickly established itself as a defining fashion name, driven by denim, accessories, and an unmistakable image culture.",
    focus: "The brand carries strong symbolic value: iconic campaigns, recognisable glamour, and a lifestyle positioning that merges American confidence with European style references across apparel and accessories.",
    atmosphere: "Confident, glamorous, high-recognition.",
    categories: ["Denim", "Accessories", "Lifestyle Fashion"],
    tone: "A statement brand whose commercial strength is reinforced by visual memory and image power."
  },
  "iblues": {
    eyebrow: "Modern Femininity",
    heroTitle: "Glamour for Fashionable Women",
    summary: "Italian womenswear with bold shapes, expressive color, and an effortless version of glamour.",
    intro: "Founded in 1975 within the Max Mara Fashion Group, iBlues developed into a total-look collection spanning ready-to-wear, shoes, bags, and accessories.",
    focus: "Its customer is curious, fashion-aware, and willing to take stylistic risks. The brand responds with feminine silhouettes, clean detailing, and fabrics that support a polished but easy kind of glamour.",
    atmosphere: "Feminine, current, self-assured.",
    categories: ["Womenswear", "Accessories", "Effortless Glamour"],
    tone: "A more fashion-forward feminine voice that remains wearable and composed."
  },
  "malina": {
    eyebrow: "Vibrant Womenswear",
    heroTitle: "Vibrant collections for the modern woman",
    summary: "Stockholm-designed womenswear shaped by Mediterranean color, print, and a confident sense of occasion.",
    intro: "Founded in Stockholm in 2010 by Malin Ek Andrén, Malina brings together Scandinavian clarity with Mediterranean warmth and Hellenic influence.",
    focus: "The collections are built around vibrant print, richer fabric stories, and clothing that helps women feel dressed up without overcomplication. It is a brand with energy, but also with functional purpose.",
    atmosphere: "Vibrant, chic, expressive.",
    categories: ["Occasionwear", "Print-led Womenswear", "Elevated Day Dressing"],
    tone: "A confident womenswear line where elegance and visual energy stay in balance."
  },
  "more-and-more": {
    eyebrow: "Everyday Elegance",
    heroTitle: "More Inspiration",
    summary: "German womenswear built around feminine dressing, practical coordination, and strong day-to-day value.",
    intro: "Founded in 1982 in Starnberg, More & More has developed a consistent proposition across feminine businesswear, polished everyday dressing, and casual pieces with easy coordination.",
    focus: "Its strength lies in usability. Collections are designed to combine across seasons, maintain value, and support a customer defined less by age than by attitude and lifestyle.",
    atmosphere: "Approachable, polished, dependable.",
    categories: ["Daywear", "Business Dressing", "Casual Coordinates"],
    tone: "Commercially clear fashion with a softer, feminine practicality."
  },
  "puntododici": {
    eyebrow: "Italian Outerwear",
    heroTitle: "The irresistible lightness of Italian style",
    summary: "Outerwear built on lightness, comfort, and Italian styling, with technical knowledge at its core.",
    intro: "Founded near Lake Garda in 2012, Puntododici set out to create outerwear that combines lightweight construction, premium goose down, comfort, and unmistakable Italian character.",
    focus: "The collections are shaped by deep outerwear expertise and a close attention to detail. What emerges is casual-chic design that blends iconic references with newer fashion elements while preserving technical credibility.",
    atmosphere: "Light, technical, Italian.",
    categories: ["Outerwear", "Down Pieces", "Casual-Chic Layers"],
    tone: "An outerwear-first brand where comfort and Italian style remain inseparable."
  },
  "rich-royal": {
    eyebrow: "Premium Lifestyle",
    heroTitle: "Live rich - act royal",
    summary: "Contemporary premium fashion with expressive color, tactile fabrics, and a strong feminine self-image.",
    intro: "Rich & Royal positions itself as a modern German lifestyle brand, built around premium dressing that feels current, feminine, and responsive to trend without becoming disposable.",
    focus: "The brand’s language is carried by fabric feel, color, and considered detailing. It also places visible importance on sustainability through materials, packaging, supplier selection, and production standards.",
    atmosphere: "Confident, premium, trend-aware.",
    categories: ["Premium Womenswear", "Lifestyle Fashion", "Responsible Production"],
    tone: "A premium fashion voice that combines femininity, confidence, and material attention."
  },
  "yaya": {
    eyebrow: "Soft Modernity",
    heroTitle: "It’s A State of Mind",
    summary: "A lifestyle brand built around soft fabrics, toned-down color, and accessible design with long-term wearability.",
    intro: "Founded in 1992 near Amsterdam, YAYA extends beyond womenswear into home accessories, but keeps the same values across both worlds: comfort, femininity, and a calm, desirable design language.",
    focus: "The collections are known for softness, ease of styling, and a lowered visual volume that still retains charm. YAYA presents itself less as a demographic label and more as an attitude toward everyday living.",
    atmosphere: "Soft, calm, lifestyle-led.",
    categories: ["Womenswear", "Home Accessories", "Soft Essentials"],
    tone: "A quieter lifestyle proposition defined by warmth, accessibility, and understated charm."
  },
  "0039-italy": {
    eyebrow: "Blouse Expertise",
    heroTitle: "True to itself and to its Roots",
    summary: "A German label with an Italian sensibility, built around blouses as the enduring center of its identity.",
    intro: "0039 Italy began in 2000 and built its reputation by rethinking the blouse beyond its conservative stereotype, turning it into a contemporary fashion proposition with longevity.",
    focus: "Its distinctiveness comes from discipline. Rather than chasing breadth, the brand remains committed to its roots, allowing the blouse to stay central while collections evolve around that core with consistency and clarity.",
    atmosphere: "Focused, refined, enduring.",
    categories: ["Blouses", "Womenswear", "Italian-Informed Essentials"],
    tone: "A tightly defined brand built on consistency, signature product focus, and quiet evolution."
  }
};

const genericCopy = (brand) => ({
  eyebrow: "Brand Portfolio",
  summary: `${brand.name} contributes a distinct point of view to the Bollag Guggenheim Fashion Group brand landscape in Switzerland.`,
  intro: `${brand.name} is presented as part of a curated portfolio built around premium positioning, recognisable identity, and long-term market relevance.`,
  focus: "Within the broader BG context, each brand is selected for clarity of proposition, visual strength, and compatibility with both wholesale and retail environments.",
  atmosphere: "Distinctive, premium, market-aware.",
  categories: ["Seasonal Collection", "Wholesale", "Retail Presence"],
  tone: "A clear identity supported by an editorial presentation."
});

module.exports = brands.map((brand) => {
  const slugSelection = selection.filter((item) => item.href === `/brands/${brand.slug}/`);
  const feed = brandFeed[brand.slug] || { heroImage: null, gallery: [] };
  const pageMedia = brandPageMedia[brand.slug] || { heroImage: null, gallery: [] };
  const profile = editorialCopy[brand.slug] || genericCopy(brand);
  const selectionGallery = slugSelection.slice(0, 4).map((item) => ({ image: item.image, note: item.note }));
  const heroImage = slugSelection[0]?.image || feed.heroImage || pageMedia.heroImage || null;
  const gallerySource = selectionGallery.length ? selectionGallery : (pageMedia.gallery.length ? pageMedia.gallery : feed.gallery);
  const gallery = gallerySource.slice(0, 4);
  const detailHeroImage = pageMedia.heroImage || feed.heroImage || slugSelection[0]?.image || null;
  const detailGallerySource = pageMedia.gallery.length
    ? pageMedia.gallery
    : (pageMedia.heroImage
      ? [{ image: pageMedia.heroImage, note: `${brand.name} header image` }, ...feed.gallery]
      : (feed.gallery.length ? feed.gallery : selectionGallery));
  const detailGallery = detailGallerySource;

  return {
    ...brand,
    ...profile,
    heroImage,
    gallery,
    detailHeroImage,
    detailGallery,
    href: `/brands/${brand.slug}/`
  };
});
