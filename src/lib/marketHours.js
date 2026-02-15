const EASTERN_TIMEZONE = 'America/New_York';
const OPEN_MINUTES = 9 * 60 + 30;
const CLOSE_MINUTES = 16 * 60;

const eastFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: EASTERN_TIMEZONE,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const toDateParts = (date = new Date()) => {
  const parts = eastFormatter.formatToParts(date);
  const getPart = (type) => parts.find((part) => part.type === type)?.value;

  const year = Number(getPart('year'));
  const month = Number(getPart('month'));
  const day = Number(getPart('day'));
  const hour = Number(getPart('hour'));
  const minute = Number(getPart('minute'));
  const second = Number(getPart('second'));
  const weekdayLabel = getPart('weekday') || '';

  const weekdayMap = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    weekday: weekdayMap[weekdayLabel] ?? 0,
  };
};

const dateKey = (year, month, day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const nthWeekdayOfMonth = (year, month, weekday, nth) => {
  const first = new Date(Date.UTC(year, month, 1));
  const firstWeekday = first.getUTCDay();
  const offset = (weekday - firstWeekday + 7) % 7;
  return 1 + offset + (nth - 1) * 7;
};

const lastWeekdayOfMonth = (year, month, weekday) => {
  const last = new Date(Date.UTC(year, month + 1, 0));
  const lastDate = last.getUTCDate();
  const offset = (last.getUTCDay() - weekday + 7) % 7;
  return lastDate - offset;
};

const getObservedDate = (year, month, day) => {
  const utcDate = new Date(Date.UTC(year, month, day));
  const weekday = utcDate.getUTCDay();

  if (weekday === 6) {
    utcDate.setUTCDate(utcDate.getUTCDate() - 1);
  } else if (weekday === 0) {
    utcDate.setUTCDate(utcDate.getUTCDate() + 1);
  }

  return {
    year: utcDate.getUTCFullYear(),
    month: utcDate.getUTCMonth() + 1,
    day: utcDate.getUTCDate(),
  };
};

const getEasterSundayUtc = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
};

const getNyseHolidayKeysForYear = (year) => {
  const holidays = [];

  const addObserved = (month, day) => {
    const observed = getObservedDate(year, month, day);
    holidays.push(dateKey(observed.year, observed.month, observed.day));
  };

  // New Year's Day
  addObserved(0, 1);

  // Martin Luther King Jr. Day (3rd Monday of January)
  holidays.push(dateKey(year, 1, nthWeekdayOfMonth(year, 0, 1, 3)));

  // Presidents' Day (3rd Monday of February)
  holidays.push(dateKey(year, 2, nthWeekdayOfMonth(year, 1, 1, 3)));

  // Good Friday
  const easter = getEasterSundayUtc(year);
  easter.setUTCDate(easter.getUTCDate() - 2);
  holidays.push(dateKey(easter.getUTCFullYear(), easter.getUTCMonth() + 1, easter.getUTCDate()));

  // Memorial Day (last Monday of May)
  holidays.push(dateKey(year, 5, lastWeekdayOfMonth(year, 4, 1)));

  // Juneteenth
  addObserved(5, 19);

  // Independence Day
  addObserved(6, 4);

  // Labor Day (1st Monday of September)
  holidays.push(dateKey(year, 9, nthWeekdayOfMonth(year, 8, 1, 1)));

  // Thanksgiving (4th Thursday of November)
  holidays.push(dateKey(year, 11, nthWeekdayOfMonth(year, 10, 4, 4)));

  // Christmas Day
  addObserved(11, 25);

  return holidays;
};

const getHolidaySet = (year) => {
  const keys = new Set();

  [year - 1, year, year + 1].forEach((holidayYear) => {
    getNyseHolidayKeysForYear(holidayYear).forEach((key) => keys.add(key));
  });

  return keys;
};

const isBusinessDay = (date = new Date()) => {
  const { weekday } = toDateParts(date);
  return weekday >= 1 && weekday <= 5;
};

const isMarketHoliday = (date = new Date()) => {
  const { year, month, day } = toDateParts(date);
  const holidaySet = getHolidaySet(year);
  return holidaySet.has(dateKey(year, month, day));
};

const getMinutes = (date = new Date()) => {
  const { hour, minute } = toDateParts(date);
  return hour * 60 + minute;
};

const getTimeZoneOffset = (date, timeZone) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type) => Number(parts.find((part) => part.type === type)?.value ?? 0);

  const asUtc = Date.UTC(
    getPart('year'),
    getPart('month') - 1,
    getPart('day'),
    getPart('hour'),
    getPart('minute'),
    getPart('second'),
  );

  return asUtc - date.getTime();
};

const easternDateToUtcDate = (year, month, day, hour = 0, minute = 0, second = 0) => {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const offset = getTimeZoneOffset(utcGuess, EASTERN_TIMEZONE);
  return new Date(utcGuess.getTime() - offset);
};

export const getMarketStatus = (date = new Date()) => {
  if (!isBusinessDay(date)) return 'Weekend';
  if (isMarketHoliday(date)) return 'Holiday';

  const minutes = getMinutes(date);

  if (minutes >= OPEN_MINUTES && minutes < CLOSE_MINUTES) return 'Open';
  if (minutes < OPEN_MINUTES) return 'Pre-Market';
  return 'After Hours';
};

export const isMarketOpen = (date = new Date()) => getMarketStatus(date) === 'Open';

export const getNextMarketOpen = (date = new Date()) => {
  if (isMarketOpen(date)) return new Date(date);

  const reference = toDateParts(date);
  const base = new Date(Date.UTC(reference.year, reference.month - 1, reference.day, 12, 0, 0));

  for (let i = 0; i < 14; i += 1) {
    const candidate = new Date(base);
    candidate.setUTCDate(base.getUTCDate() + i);

    const parts = toDateParts(candidate);
    const candidateDate = easternDateToUtcDate(parts.year, parts.month, parts.day, 9, 30, 0);

    if (!isBusinessDay(candidateDate) || isMarketHoliday(candidateDate)) {
      continue;
    }

    if (i === 0) {
      const nowMinutes = getMinutes(date);
      if (nowMinutes < OPEN_MINUTES) {
        return candidateDate;
      }
      continue;
    }

    return candidateDate;
  }

  return easternDateToUtcDate(reference.year, reference.month, reference.day, 9, 30, 0);
};

export default {
  isMarketOpen,
  getNextMarketOpen,
  getMarketStatus,
};
