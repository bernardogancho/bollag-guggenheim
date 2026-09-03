// The Agenda lists showroom appointments. Once an appointment's last day has
// passed it should drop off the page on its own, so this filters the content
// at build time (see the daily rebuild in .github/workflows/deploy-cyon.yml,
// which keeps the page current even when nobody publishes).
//
// Dates are typed by hand as free text ("21 April - 21 May 2026"), so the end
// date is read from the label rather than a separate field — editors keep
// working exactly as they do now. Two deliberately conservative rules keep a
// typo from hiding a real appointment:
//
//   1. A label we cannot understand is always shown.
//   2. An event is hidden only if its own end date has passed AND the month it
//      is filed under has ended. An event filed under "January 2027" cannot
//      really be over while January 2027 is still ahead — which is what saves
//      "25 JANUARY - 5 FEBRUARY 2026", where the year is a typo for 2027.
const content = require("./cms/agenda.json");

const MONTH_NUMBERS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
};

// The end of a range is its right-hand side; a single date is its own end.
const parseEndDate = (label) => {
  if (typeof label !== "string") {
    return null;
  }
  const lastPart = label.split(/[-–—]/).pop();
  const match = /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/.exec(lastPart || "");
  if (!match) {
    return null;
  }
  const month = MONTH_NUMBERS[match[2].toLowerCase()];
  if (!month) {
    return null;
  }
  const date = new Date(Date.UTC(Number(match[3]), month - 1, Number(match[1])));
  return Number.isNaN(date.getTime()) ? null : date;
};

// "April 2026" -> the first instant of May 2026, i.e. the moment it is over.
const parseMonthEnd = (label) => {
  const match = /([A-Za-z]+)\s+(\d{4})/.exec(String(label || ""));
  if (!match) {
    return null;
  }
  const month = MONTH_NUMBERS[match[1].toLowerCase()];
  if (!month) {
    return null;
  }
  return new Date(Date.UTC(Number(match[2]), month, 1));
};

const startOfToday = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

const today = startOfToday();

// Keep each item's position in the source file: the CMS bindings and the live
// preview address content by index, so filtered-out items must not shift them.
const months = (content.months || []).map((month, monthIndex) => {
  const monthEnd = parseMonthEnd(month.month);
  const monthIsOver = monthEnd !== null && monthEnd <= today;

  const events = (month.events || [])
    .map((event, eventIndex) => ({ ...event, sourceIndex: eventIndex }))
    .filter((event) => {
      const endDate = parseEndDate(event.dateLabel);
      if (endDate === null) {
        return true;
      }
      return !(endDate < today && monthIsOver);
    });

  return { ...month, events, sourceIndex: monthIndex };
}).filter((month) => month.events.length > 0);

module.exports = { ...content, months };
