export function getWorkingDaysInMonth(year, monthIndex) {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  let count = 0;
  for (let day = 1; day <= daysInMonth; day += 1) {
    if (new Date(year, monthIndex, day).getDay() !== 0) count += 1;
  }
  return count;
}

export function parseMonthKey(monthKey) {
  const match = String(monthKey || '').match(/^(\w+)\s+(\d{4})$/);
  if (!match) return null;
  const months = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
  const monthIndex = months[match[1]];
  if (monthIndex === undefined) return null;
  return { year: Number(match[2]), monthIndex };
}

export function getWorkingDaysForMonthKey(monthKey) {
  return WORKING_DAYS_BY_MONTH[monthKey] || DEFAULT_WORKING_DAYS;
}

export function setWorkingDaysCalendar(entries = []) {
  Object.keys(WORKING_DAYS_BY_MONTH).forEach((key) => delete WORKING_DAYS_BY_MONTH[key]);
  entries.forEach((entry) => {
    const days = Number(entry.workingDays ?? entry.working_days);
    if (entry.monthKey && Number.isFinite(days) && days > 0) WORKING_DAYS_BY_MONTH[entry.monthKey] = days;
  });
}

export function getIsoMonthKey(monthKey) {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) return String(monthKey || "").match(/^\d{4}-\d{2}$/) ? monthKey : "";
  return `${parsed.year}-${String(parsed.monthIndex + 1).padStart(2, "0")}`;
}

export function getMonthKeyFromDate(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function getWorkingDaysForDate(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return DEFAULT_WORKING_DAYS;
  return getWorkingDaysForMonthKey(getMonthKeyFromDate(dateStr));
}
const DEFAULT_WORKING_DAYS = 24;
const WORKING_DAYS_BY_MONTH = {};
