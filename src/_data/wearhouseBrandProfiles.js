const wearhouse = require("./wearhouse");

const profileContent = {
  masons: {
    summary: "MASON`S brings Italian smart-casual dressing into the Wearhouse portfolio through a mix of tailored structure, relaxed attitude, and utility-driven silhouettes.",
    intro: "Rooted in Italian menswear culture and expanded into womenswear, MASON`S is known for building modern wardrobe staples around trousers, outerwear, field-inspired details, and an unmistakably polished casual tone. The brand’s official presentation consistently frames it around everyday versatility rather than formal rigidity.",
    focus: "Within the Wearhouse mix, MASON`S adds a refined off-duty language: garments that feel practical and contemporary, but still carry a sartorial backbone. It strengthens the portfolio where tailoring, utility, and premium casualwear intersect.",
    atmosphere: "Italian sartorial casualwear.",
    categories: ["Utility tailoring", "Womenswear & menswear"]
  },
  "circolo-1901": {
    summary: "CIRCOLO 1901 contributes a softer, more comfortable tailoring perspective to the Wearhouse portfolio, centred on ease, jersey innovation, and contemporary polish.",
    intro: "The brand is best known for translating the visual codes of tailoring into garments that feel notably lighter and more relaxed to wear. Its official brand positioning revolves around effortless jackets, modern coordinates, and a wardrobe that moves between smart and casual without friction.",
    focus: "For Wearhouse, CIRCOLO 1901 anchors the segment where tailoring meets comfort. It offers a cleaner, more fluid interpretation of contemporary dressing and adds credibility in the easy-jacket, soft-structure part of the market.",
    atmosphere: "Soft tailoring with ease.",
    categories: ["Comfort tailoring", "Womenswear & menswear"]
  },
  "save-the-duck": {
    summary: "SAVE THE DUCK brings technical outerwear and a clear animal-free identity into the Wearhouse portfolio, combining function, color, and a recognisable sustainability message.",
    intro: "From the start, the brand has built its position around replacing animal-derived materials with high-performance alternatives while keeping the product light, wearable, and urban. Its official storytelling consistently connects innovation, responsibility, and everyday outerwear that works across women’s, men’s, and kids’ collections.",
    focus: "Inside the Wearhouse roster, SAVE THE DUCK broadens the offer with a strong outerwear proposition and a value-led narrative customers immediately understand. It adds technical credibility, seasonal relevance, and a distinctly contemporary brand voice.",
    atmosphere: "Animal-free technical outerwear.",
    categories: ["Outerwear", "Women, men & kids"]
  },
  "daniele-fiesoli": {
    summary: "DANIELE FIESOLI introduces a knitwear-led, Made in Italy point of view to the Wearhouse portfolio, centred on texture, research, and understated refinement.",
    intro: "The official brand material places inspiration, observation, curiosity, and experimentation at the centre of the label. Knitwear is not treated as a basic category, but as a field for material research and emotional design, where artisanal Italian know-how meets a more modern, exploratory sensibility.",
    focus: "For Wearhouse, DANIELE FIESOLI strengthens the premium menswear offer through elevated knitwear and a more cultured product language. It is less about trend noise and more about fabric, touch, and long-term wardrobe value.",
    atmosphere: "Research-driven Italian knitwear.",
    categories: ["Made in Italy", "Menswear"]
  },
  "tintoria-mattei": {
    summary: "TINTORIA MATTEI brings shirtmaking heritage into the Wearhouse portfolio through washed finishes, lived-in elegance, and a recognisably Italian casual spirit.",
    intro: "Built around the shirt as its core product, the brand is associated with fabric character, dye treatments, and a relaxed interpretation of traditional tailoring codes. Its appeal comes from making classics feel less rigid and more personal, with product that sits naturally between everyday wear and more dressed styling.",
    focus: "Within the Wearhouse selection, TINTORIA MATTEI adds authenticity and product depth in the shirting category. It supports the portfolio with an offering that feels crafted, tactile, and consistently relevant across seasons.",
    atmosphere: "Italian shirtmaking with character.",
    categories: ["Shirting", "Women & men"]
  },
  caliban: {
    summary: "CALIBAN adds a refined Italian shirting and blouse perspective to the Wearhouse portfolio, with a stronger emphasis on fabric quality, crisp construction, and wardrobe elegance.",
    intro: "The label is closely associated with premium shirtmaking and a clean, sophisticated interpretation of essentials. Across its official presentation and market positioning, CALIBAN reads as a brand built on precision, elevated materials, and a more polished take on everyday dressing.",
    focus: "For Wearhouse, CALIBAN sharpens the portfolio in the dressier end of womenswear. It contributes product that is articulate and composed, especially where blouses and shirts need to feel premium without becoming overly formal.",
    atmosphere: "Refined Italian shirting.",
    categories: ["Premium blouses", "Womenswear"]
  },
  duno: {
    summary: "DUNO brings metropolitan outerwear into the Wearhouse portfolio through clean silhouettes, technical function, and an urban premium positioning.",
    intro: "The brand is built around the idea that performance and elegance do not need to be separated. Official communication and product presentation consistently emphasise lightweight protection, contemporary city dressing, and a restrained aesthetic that feels modern rather than overtly sporty.",
    focus: "Inside the Wearhouse mix, DUNO strengthens the outerwear category with a more architectural, minimal offer. It suits customers looking for technical product with a sharper urban finish and broad day-to-day usability.",
    atmosphere: "Urban technical outerwear.",
    categories: ["Performance outerwear", "Womenswear & menswear"]
  },
  ibeliv: {
    summary: "IBELIV introduces a craft-led accessories point of view to the Wearhouse portfolio, grounded in natural fibres, handwork, and a quieter sense of luxury.",
    intro: "The brand is closely tied to Madagascar and to handmade production, with bags and accessories that foreground material honesty, artisanal process, and long-lasting design. Its official presentation is less seasonal and trend-led than many fashion labels, focusing instead on authenticity, texture, and timeless use.",
    focus: "For Wearhouse, IBELIV expands the accessories offer with a label that feels warm, tactile, and rooted in craftsmanship. It provides contrast to more technical or fashion-driven brands while keeping the overall portfolio elevated.",
    atmosphere: "Handcrafted natural-fibre accessories.",
    categories: ["Accessories", "Craft-led design"]
  },
  "le-bonnet": {
    summary: "LE BONNET adds a premium essentials layer to the Wearhouse portfolio through knit accessories defined by color, natural fibres, and a clear lifestyle identity.",
    intro: "The brand is positioned around beanies, scarves, and knit staples made from high-quality natural yarns, with a strong emphasis on long-term wear rather than short-lived trend cycles. Its official presentation links product to responsible material choices, clean design, and a recognisable Amsterdam sensibility.",
    focus: "Within the Wearhouse mix, LE BONNET strengthens the accessories segment with product that is simple, giftable, and highly brand-recognisable. It is a compact label, but one with strong visual clarity and dependable premium appeal.",
    atmosphere: "Premium knit essentials.",
    categories: ["Accessories", "Natural fibres"]
  },
  edelle: {
    summary: "edelle brings a feminine, detail-focused collection into the Wearhouse portfolio, centred on blouses, dresses, knitwear, and a softer form of everyday elegance.",
    intro: "On the official site, the brand describes itself as having grown from a blouse-led starting point into a broader collection for modern women, with particular attention to fit, finishing, accessories, and carefully selected materials. The emphasis is on garments that feel composed and tactile rather than loud or trend-dependent.",
    focus: "For Wearhouse, edelle supports the women’s offer with a quieter premium segment that values fabric, shape, and wearability. It works especially well where customers respond to thoughtful styling and a more intimate wardrobe tone.",
    atmosphere: "Feminine wardrobe essentials.",
    categories: ["Blouses & dresses", "Womenswear"]
  },
  "via-masini": {
    summary: "VIA MASINI adds a focused Italian womenswear voice to the Wearhouse portfolio, with an emphasis on trousers, modern silhouettes, and confident day-to-evening dressing.",
    intro: "The brand’s official presentation centres on women’s fashion with a strong Italian point of view and a wardrobe built around clean cuts, directional styling, and elevated everyday pieces. The label reads as contemporary rather than minimal, balancing fashion awareness with commercial clarity.",
    focus: "Inside the Wearhouse roster, VIA MASINI contributes sharper feminine styling and a more fashion-forward attitude. It gives the portfolio a stronger offer where fit, silhouette, and contemporary wardrobe building matter most.",
    atmosphere: "Italian contemporary womenswear.",
    categories: ["Tailored silhouettes", "Womenswear"]
  },
  velvet: {
    summary: "VELVET brings relaxed premium essentials into the Wearhouse portfolio, blending Californian ease with fabric quality and a wardrobe-first approach.",
    intro: "The brand is widely associated with elevated basics, soft materials, and pieces that feel easy to wear without looking generic. Official brand presentation consistently places emphasis on comfort, simplicity, and thoughtful design rather than statement-driven styling.",
    focus: "For Wearhouse, VELVET fills the space where luxury casualwear needs to feel effortless, tactile, and dependable. It supports a quieter, more lifestyle-oriented side of the assortment across women’s and men’s product.",
    atmosphere: "Relaxed premium essentials.",
    categories: ["Elevated basics", "Women & men"]
  },
  tanta: {
    summary: "TANTÄ adds a colorful waterproof proposition to the Wearhouse portfolio, grounded in rainwear expertise, durability, and a distinctive Basque brand identity.",
    intro: "TANTÄ comes from a family company in the Basque Country with decades of experience in waterproof clothing. Launched to offer fully waterproof pieces in strong color and clean shapes, it positions durability and timeless function as a more sustainable alternative to disposable fashion.",
    focus: "Within the Wearhouse mix, TANTÄ gives the outerwear offer a more playful and weather-specific dimension. It combines practicality with visual freshness and works especially well as a recognisable specialist label.",
    atmosphere: "Colorful waterproof design.",
    categories: ["Rainwear", "Women & men"]
  },
  sassenbach: {
    summary: "SASSENBACH brings a focused women’s proposition into the Wearhouse portfolio through easy elegance, comfort, and a product language built for everyday sophistication.",
    intro: "The brand reads as contemporary womenswear with an emphasis on wearability, clean styling, and a polished but approachable attitude. Even where official background material is limited, the collection presentation consistently frames it as a label for women looking for refined product that remains easy to integrate into daily life.",
    focus: "For Wearhouse, SASSENBACH supports the women’s segment with calm, commercial product that sits between casual and dressed. It helps broaden the assortment where understated style and practical elegance are the key drivers.",
    atmosphere: "Easy refined womenswear.",
    categories: ["Contemporary womenswear", "Day-to-day elegance"]
  },
  "dea-kudibal": {
    summary: "DEA KUDIBAL adds a more expressive luxury womenswear angle to the Wearhouse portfolio, known for rich prints, fluid fabrics, and feminine silhouettes.",
    intro: "Founded in Copenhagen, the brand is recognised for combining elevated colour, decorative surface, and flattering shapes with a polished contemporary feel. Its official presentation strongly links the label to printed silk, easy glamour, and product that feels dressed without becoming rigid.",
    focus: "Within the Wearhouse mix, DEA KUDIBAL introduces a more confident visual identity and a clearly premium feminine proposition. It strengthens the portfolio where occasion, print, and statement elegance need to coexist with wearability.",
    atmosphere: "Printed feminine luxury.",
    categories: ["Statement womenswear", "Copenhagen brand"]
  },
  ffc: {
    summary: "FFC brings modern premium womenswear into the Wearhouse portfolio, with a particular strength in knitwear, soft tailoring, and polished everyday separates.",
    intro: "The brand is positioned in the German premium segment and is especially associated with knitwear, clean seasonal colour, and wearable wardrobe building. Even where brand-story content is limited on the official site, the collection framing points clearly to quality-driven womenswear that balances comfort, clarity, and modern styling.",
    focus: "For Wearhouse, FFC strengthens the women’s offer with dependable premium product that is commercially clear but still elevated. It is particularly effective in the space between casual knitwear and refined daywear.",
    atmosphere: "Premium knit-led womenswear.",
    categories: ["Knitwear", "Womenswear"]
  }
};

module.exports = wearhouse.brands.map((brand) => {
  const detailGallery = [brand.detailImage, brand.hoverImage]
    .filter(Boolean)
    .filter((image, index, images) => images.indexOf(image) === index)
    .map((image, index) => ({
      image,
      note: `${brand.name} image ${index + 1}`
    }));

  const profile = profileContent[brand.slug] || {
    summary: `${brand.name} is represented in Switzerland through The Wearhouse portfolio, adding a distinct point of view to the agency roster.`,
    intro: `${brand.name} sits inside The Wearhouse mix as part of a curated agency portfolio spanning womenswear, menswear, accessories, and specialist labels with a strong showroom identity.`,
    focus: "Its role in the portfolio is defined by recognisable product identity, consistent seasonal image, and a market position that complements the broader Bollag Guggenheim universe without duplicating it.",
    atmosphere: "Swiss representation through The Wearhouse.",
    categories: [brand.segment, "The Wearhouse"]
  };

  return {
    ...brand,
    ...profile,
    eyebrow: "Wearhouse Brand",
    detailHeroImage: brand.detailImage || brand.hoverImage,
    detailGallery,
    officialHref: brand.websiteHref
  };
});
