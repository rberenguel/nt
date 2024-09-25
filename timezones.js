export { timezones };

// This needs to be in IANA format, whatever Luxon can take will work: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones

const timezones = [
  {
    timezone: "America/New_York",
    name: "New York",
  },
  {
    timezone: "Europe/Zurich",
    name: "ZRH",
  },
  // TODO(me) fix with Luxon
  {
    timezone: "Europe/Paris",
    name: "🥐",
  },
];
