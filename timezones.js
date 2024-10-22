// This needs to be in IANA format, whatever Luxon can take will work: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones

const timezones = [
  {
    timezone: "America/Los_Angeles",
    name: "SVL",
  },
  {
    timezone: "America/New_York",
    name: "NY",
  },
  {
    timezone: "Europe/Zurich",
    name: "ZRH",
  },
];

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = { timezones }; 
} else {
  window.timezones = timezones;
}
