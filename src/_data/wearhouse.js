const createWearhouseLogoSvg = (brand) => {
  const lines = brand.logoLines || [brand.name];
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
  const fontSize = brand.logoFontSize || (longest > 14 ? 38 : longest > 10 ? 44 : 52);
  const lineHeight = Math.round(fontSize * 1.02);
  const width = 720;
  const paddingX = 36;
  const height = Math.max(160, 56 + (lines.length * lineHeight));
  const startY = lines.length === 1
    ? Math.round(height / 2 + fontSize * 0.26)
    : Math.round((height - (lines.length * lineHeight)) / 2 + fontSize);

  const text = lines.map((line, index) => {
    const y = startY + (index * lineHeight);
    return `<text x="50%" y="${y}" text-anchor="middle">${line}</text>`;
  }).join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${brand.name}"><style>text{fill:#111111;font-family:'Helvetica Neue',Arial,sans-serif;font-size:${fontSize}px;font-weight:400;letter-spacing:-0.04em;text-transform:uppercase}<\/style>${text}</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const brands = [
  {
    name: "MASON`S",
    slug: "masons",
    segment: "donna & uomo",
    websiteHref: "https://www.wearhouse.ch/masons",
    logoSrc: "/assets/media/wearhouse/logos/masons.clean.png",
    hoverImage: "/assets/media/wearhouse/brands/masons-matrix.jpg",
    detailImage: "/assets/media/wearhouse/brands/masons.jpg",
    logoLines: ["MASON`S"]
  },
  {
    name: "CIRCOLO 1901",
    slug: "circolo-1901",
    segment: "donna & uomo",
    websiteHref: "https://www.wearhouse.ch/circolo1901",
    logoSrc: "/assets/media/wearhouse/logos/circolo-1901.clean.png",
    hoverImage: "/assets/media/wearhouse/brands/circolo1901-matrix.jpg",
    detailImage: "/assets/media/wearhouse/brands/circolo1901.jpg",
    logoLines: ["CIRCOLO 1901"]
  },
  {
    name: "SAVE THE DUCK",
    slug: "save-the-duck",
    segment: "donna, uomo & bambini",
    websiteHref: "https://www.wearhouse.ch/savetheduck",
    logoSrc: "/assets/media/wearhouse/logos/save-the-duck.clean.png",
    hoverImage: "/assets/media/wearhouse/brands/savetheduck-matrix.jpg",
    detailImage: "/assets/media/wearhouse/brands/savetheduck.jpg",
    logoLines: ["SAVE THE", "DUCK"]
  },
  {
    name: "DANIELE FIESOLI",
    slug: "daniele-fiesoli",
    segment: "uomo",
    websiteHref: "https://www.danielefiesoli.com/",
    logoSrc: "/assets/media/wearhouse/logos/daniele-fiesoli.clean.png",
    hoverImage: "/assets/media/wearhouse/brands/danielefiesoli-matrix.jpg",
    logoLines: ["DANIELE", "FIESOLI"]
  },
  {
    name: "TINTORIA MATTEI",
    slug: "tintoria-mattei",
    segment: "uomo & donna",
    websiteHref: "https://www.wearhouse.ch/tintoriamattei",
    logoSrc: "/assets/media/wearhouse/logos/tintoria-mattei.clean.png",
    hoverImage: "/assets/media/wearhouse/brands/tintoriamattei-matrix.jpg",
    detailImage: "/assets/media/wearhouse/brands/tintoriamattei.jpg",
    logoLines: ["TINTORIA", "MATTEI"]
  },
  {
    name: "CALIBAN",
    slug: "caliban",
    segment: "donna",
    websiteHref: "https://www.wearhouse.ch/caliban",
    logoSrc: "/assets/media/wearhouse/logos/caliban.clean.png",
    hoverImage: "/assets/media/wearhouse/brands/caliban-matrix.jpg",
    detailImage: "/assets/media/wearhouse/brands/caliban.jpg",
    logoLines: ["CALIBAN"]
  },
  {
    name: "DUNO",
    slug: "duno",
    segment: "donna & uomo",
    websiteHref: "https://www.wearhouse.ch/duno",
    logoSrc: "/assets/media/wearhouse/logos/duno.clean.png",
    hoverImage: "/assets/media/wearhouse/brands/duno-matrix.jpg",
    detailImage: "/assets/media/wearhouse/brands/duno.jpg",
    logoLines: ["DUNO"]
  },
  {
    name: "IBELIV",
    slug: "ibeliv",
    segment: "donna & uomo",
    websiteHref: "https://www.wearhouse.ch/ibeliv",
    logoSrc: "/assets/media/wearhouse/logos/ibeliv.clean.png",
    hoverImage: "/assets/media/wearhouse/brands/ibeliv-matrix.jpg",
    detailImage: "/assets/media/wearhouse/brands/ibeliv.jpg",
    logoLines: ["IBELIV"]
  },
  {
    name: "LE BONNET",
    slug: "le-bonnet",
    segment: "donna, uomo & kids",
    websiteHref: "https://www.wearhouse.ch/lebonnet",
    logoSrc: "/assets/media/wearhouse/logos/le-bonnet.clean.png",
    hoverImage: "/assets/media/wearhouse/brands/lebonnet-matrix.jpg",
    logoLines: ["LE BONNET"]
  },
  {
    name: "edelle",
    slug: "edelle",
    segment: "donna",
    websiteHref: "https://edelle.de/",
    logoSrc: "/assets/media/wearhouse/logos/edelle.svg",
    hoverImage: "/assets/media/wearhouse/brands/edelle-matrix.jpg",
    logoLines: ["EDELLE"]
  },
  {
    name: "VIA MASINI",
    slug: "via-masini",
    segment: "donna",
    websiteHref: "https://viamasini80.it/",
    hoverImage: "/assets/media/wearhouse/brands/viamasini-matrix.jpg",
    logoLines: ["VIA MASINI"]
  },
  {
    name: "VELVET",
    slug: "velvet",
    segment: "women men",
    websiteHref: "https://velvet-tees.com/",
    logoSrc: "/assets/media/wearhouse/logos/velvet.svg",
    hoverImage: "/assets/media/wearhouse/brands/velvet-matrix.jpg",
    logoLines: ["VELVET"]
  },
  {
    name: "TANTÄ",
    slug: "tanta",
    segment: "mujer hombre",
    websiteHref: "https://tantarainwear.com/",
    logoSrc: "/assets/media/wearhouse/logos/tanta.png",
    hoverImage: "/assets/media/wearhouse/brands/tanta-matrix.webp",
    logoLines: ["TANTÄ"]
  },
  {
    name: "SASSENBACH",
    slug: "sassenbach",
    segment: "donna",
    websiteHref: "https://www.sassenbach-style.de/",
    logoSrc: "/assets/media/wearhouse/logos/sassenbach.svg",
    hoverImage: "/assets/media/wearhouse/brands/sassenbach-matrix.jpg",
    logoLines: ["SASSENBACH"]
  },
  {
    name: "DEA KUDIBAL",
    slug: "dea-kudibal",
    segment: "donna",
    websiteHref: "https://deakudibal.de/",
    logoSrc: "/assets/media/wearhouse/logos/dea-kudibal.svg",
    hoverImage: "/assets/media/wearhouse/brands/deakudibal-matrix.webp",
    logoLines: ["DEA KUDIBAL"]
  },
  {
    name: "FFC",
    slug: "ffc",
    segment: "donna",
    websiteHref: "https://www.ffc-fashion.de/",
    logoSrc: "/assets/media/wearhouse/logos/ffc.clean.png",
    hoverImage: "/assets/media/wearhouse/brands/ffc-matrix.jpg",
    logoLines: ["FFC"]
  }
];

module.exports = {
  hero: {
    eyebrow: "Subsidiary",
    title: "An integrated agency world inside the group.",
    summary: "The Wearhouse Fashion Trade GmbH extends the group through a distinct agency model, a sharper showroom identity, and a portfolio spanning womenswear, menswear, accessories, and selected niche discoveries."
  },
  overview: {
    intro: "Based in Erlenbach, The Wearhouse Fashion Trade GmbH operates as an independent fashion agency within the Bollag Guggenheim context. Its proposition is built around elevated fashion labels, close market attention, and a more selective showroom perspective aimed at the Swiss market.",
    focus: "The agency positions itself around established high-casual and sportswear names while continuing to search for differentiated niche products and new discoveries. Womenswear, menswear, and accessories all form part of the offer, with each season expanding the mix through new highlights and directional additions.",
    pillars: [
      "Womenswear",
      "Menswear",
      "Accessories",
      "Swiss showroom"
    ]
  },
  contact: {
    name: "The Wearhouse Fashion Trade GmbH",
    address: ["Seestrasse 78", "8703 Erlenbach", "Schweiz"],
    phoneLabel: "+41 44 912 12 00",
    phoneHref: "tel:+41449121200",
    emailLabel: "wearhouse@wearhouse.ch",
    emailHref: "mailto:wearhouse@wearhouse.ch",
    mapsHref: "https://www.google.com/maps/search/?api=1&query=Seestrasse+78,+8703+Erlenbach,+Schweiz",
    websiteHref: "https://www.wearhouse.ch/"
  },
  brands: brands.map((brand) => ({
    ...brand,
    pageHref: `/wearhouse/${brand.slug}/`,
    logoSvg: createWearhouseLogoSvg(brand)
  })),
  showroomGallery: [
    {
      image: "/assets/media/wearhouse/showroom/wearhouse-showroom-01.jpeg",
      note: "Wearhouse showroom impression 1"
    },
    {
      image: "/assets/media/wearhouse/showroom/wearhouse-showroom-02.jpeg",
      note: "Wearhouse showroom impression 2"
    },
    {
      image: "/assets/media/wearhouse/showroom/wearhouse-showroom-03.jpeg",
      note: "Wearhouse showroom impression 3"
    },
    {
      image: "/assets/media/wearhouse/showroom/wearhouse-showroom-04.jpeg",
      note: "Wearhouse showroom impression 4"
    },
    {
      image: "/assets/media/wearhouse/showroom/wearhouse-showroom-05.jpg",
      note: "Wearhouse showroom impression 5"
    },
    {
      image: "/assets/media/wearhouse/showroom/wearhouse-showroom-06.jpeg",
      note: "Wearhouse showroom impression 6"
    },
    {
      image: "/assets/media/wearhouse/showroom/wearhouse-showroom-07.jpeg",
      note: "Wearhouse showroom impression 7"
    },
    {
      image: "/assets/media/wearhouse/showroom/wearhouse-showroom-08.jpeg",
      note: "Wearhouse showroom impression 8"
    },
    {
      image: "/assets/media/wearhouse/showroom/wearhouse-showroom-09.jpeg",
      note: "Wearhouse showroom impression 9"
    },
    {
      image: "/assets/media/wearhouse/showroom/wearhouse-showroom-10.jpeg",
      note: "Wearhouse showroom impression 10"
    },
    {
      image: "/assets/media/wearhouse/showroom/wearhouse-showroom-11.jpeg",
      note: "Wearhouse showroom impression 11"
    },
    {
      image: "/assets/media/wearhouse/showroom/wearhouse-showroom-12.jpeg",
      note: "Wearhouse showroom impression 12"
    },
    {
      image: "/assets/media/wearhouse/showroom/wearhouse-showroom-13.jpg",
      note: "Wearhouse showroom impression 13"
    },
    {
      image: "/assets/media/wearhouse/showroom/wearhouse-showroom-14.jpg",
      note: "Wearhouse showroom impression 14"
    },
    {
      image: "/assets/media/wearhouse/showroom/wearhouse-showroom-15.jpg",
      note: "Wearhouse showroom impression 15"
    }
  ]
};
