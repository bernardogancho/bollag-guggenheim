// The site-mirror map: what editors see. Pages appear in website-nav order;
// each page's sections appear in on-page order with editor-facing names.
// `file` + `keys` address the existing JSON content; field definitions still
// come from config.yml. The Wearhouse brand roster spans two files and is
// handled by the wearhouse adapter.

const CMS = 'src/_data/cms';

export const PAGES = [
  {
    id: 'homepage', label: 'Homepage', url: '/',
    sections: [
      { id: 'hero', label: 'Hero banner', hint: 'Opening video, title and subheading', file: `${CMS}/home/hero.json`, keys: ['hero'] },
      { id: 'intro', label: 'Introduction', hint: 'Small label, title, summary and image', file: `${CMS}/home/intro.json`, keys: ['intro'] },
      { id: 'bollag-portfolio', label: 'Bollag portfolio', hint: 'Brand logo wall', file: `${CMS}/home/brandsWall.json`, keys: ['brandsWall'] },
      { id: 'wearhouse-portfolio', label: 'Wearhouse portfolio', hint: 'Wearhouse brand wall', file: `${CMS}/home/wearhouseWall.json`, keys: ['wearhouseWall'] },
      { id: 'editorial-selection', label: 'Editorial selection', hint: 'Curated image mosaic', file: `${CMS}/home/selectionSection.json`, keys: ['selection'] },
    ],
  },
  {
    id: 'company', label: 'Company', url: '/company/',
    sections: [
      { id: 'hero', label: 'Hero banner', file: `${CMS}/company.json`, keys: ['hero'] },
      { id: 'intro', label: 'Introduction', file: `${CMS}/company.json`, keys: ['intro'] },
      { id: 'history', label: 'History', file: `${CMS}/company.json`, keys: ['history'] },
      { id: 'distribution', label: 'Distribution', file: `${CMS}/company.json`, keys: ['distribution'] },
    ],
  },
  {
    id: 'brands', label: 'Brands', url: '/brands/',
    sections: [
      { id: 'hero', label: 'Hero banner', file: `${CMS}/brandsPage/hero.json`, keys: ['hero'] },
      { id: 'portfolio-heading', label: 'Portfolio heading', file: `${CMS}/brandsPage/portfolio.json`, keys: ['portfolioSection'] },
      { id: 'all-brands', label: 'All brands', hint: 'Every Bollag brand and its page', file: `${CMS}/brandsPage/brands.json`, keys: ['brands'], custom: 'brands' },
      { id: 'page-settings', label: 'Brand page settings', hint: 'Shared texts on brand detail pages', file: `${CMS}/brandsPage/detail.json`, keys: ['detailPage'] },
    ],
  },
  {
    id: 'wearhouse', label: 'The Wearhouse', url: '/wearhouse/',
    sections: [
      { id: 'hero', label: 'Hero banner', file: `${CMS}/wearhousePage/hero.json`, keys: ['hero'] },
      { id: 'overview', label: 'Overview', file: `${CMS}/wearhousePage/overview.json`, keys: ['overview'] },
      {
        id: 'wearhouse-brands', label: 'Wearhouse brands', hint: 'Roster cards and brand detail pages',
        joined: true,
        files: [`${CMS}/wearhousePage/roster.json`, `${CMS}/wearhousePage/brands.json`],
      },
      { id: 'showroom', label: 'Showroom', file: `${CMS}/wearhousePage/showroom.json`, keys: ['showroomSection'] },
      { id: 'cta', label: 'Call to action', file: `${CMS}/wearhousePage/cta.json`, keys: ['cta'] },
      { id: 'page-settings', label: 'Brand detail page text', hint: 'Text shared across individual brand pages', file: `${CMS}/wearhousePage/detail.json`, keys: ['detailPage'] },
    ],
  },
  {
    id: 'stores', label: 'Stores', url: '/stores/',
    sections: [
      { id: 'hero', label: 'Hero banner', file: `${CMS}/stores.json`, keys: ['hero', 'heroStats'] },
      { id: 'network', label: 'Network introduction', file: `${CMS}/stores.json`, keys: ['networkSection'] },
      { id: 'store-list', label: 'Store list', hint: 'Store groups and their stores', file: `${CMS}/stores.json`, keys: ['groups'] },
    ],
  },
  {
    id: 'agenda', label: 'Agenda', url: '/agenda/',
    sections: [
      { id: 'hero', label: 'Hero banner', file: `${CMS}/agenda.json`, keys: ['hero'] },
      { id: 'calendar', label: 'Calendar introduction', file: `${CMS}/agenda.json`, keys: ['calendarSection'] },
      { id: 'months', label: 'Events by month', file: `${CMS}/agenda.json`, keys: ['months'] },
      { id: 'cta', label: 'Call to action', file: `${CMS}/agenda.json`, keys: ['cta'] },
    ],
  },
  {
    id: 'contact', label: 'Contact', url: '/contact/',
    sections: [
      { id: 'hero', label: 'Hero banner', file: `${CMS}/contact.json`, keys: ['hero'] },
      { id: 'offices-intro', label: 'Offices introduction', file: `${CMS}/contact.json`, keys: ['officeSection'] },
      { id: 'bollag-office', label: 'Bollag office', file: `${CMS}/contact.json`, keys: ['office'] },
      { id: 'wearhouse-partner', label: 'Wearhouse contact', file: `${CMS}/contact.json`, keys: ['wearhousePartner'] },
      { id: 'form', label: 'Contact form texts', file: `${CMS}/contact.json`, keys: ['form'] },
      { id: 'cta', label: 'Call to action', file: `${CMS}/contact.json`, keys: ['cta'] },
    ],
  },
  {
    id: 'legal', label: 'Legal Notice', url: '/legal-notice/',
    sections: [
      { id: 'hero', label: 'Hero banner', file: `${CMS}/legalNotice.json`, keys: ['hero'] },
      { id: 'company-details', label: 'Company details', file: `${CMS}/legalNotice.json`, keys: ['legal'] },
      { id: 'liability', label: 'Liability & copyright', file: `${CMS}/legalNotice.json`, keys: ['liability'] },
      { id: 'privacy', label: 'Privacy policy', hint: 'Privacy text and the downloadable PDF', file: `${CMS}/legalNotice.json`, keys: ['privacy'] },
    ],
  },
  {
    id: 'site', label: 'Header & Footer', url: '/',
    sections: [
      { id: 'navigation', label: 'Navigation menu', file: `${CMS}/site.json`, keys: ['nav'] },
      { id: 'footer', label: 'Footer', file: `${CMS}/site.json`, keys: ['footer'] },
    ],
  },
];

export function allSections() {
  return PAGES.flatMap(page => page.sections.map(section => ({ ...section, pageId: page.id, pageLabel: page.label })));
}

export function findPage(pageId) {
  return PAGES.find(page => page.id === pageId) || null;
}

export function findSection(pageId, sectionId) {
  return findPage(pageId)?.sections.find(section => section.id === sectionId) || null;
}

export function sectionsForFile(filePath) {
  return allSections().filter(section => (section.joined ? section.files.includes(filePath) : section.file === filePath));
}

export const ALL_FILES = [...new Set(allSections().flatMap(section => (section.joined ? section.files : [section.file])))];
