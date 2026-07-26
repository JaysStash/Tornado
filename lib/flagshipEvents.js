// Curated flagship events, per the original project scoping: there's no
// clean bulk photo/document feed to auto-pull this from, so it stays a
// manually curated list rather than something the data pipeline
// generates. Seeded here with two entries whose links were actually
// verified against real NWS/NHC pages - not filled in speculatively.
// Add more the same way: real link, checked before it ships.
//
// `eventId` links a flagship entry to one specific record in the static
// data (must match an id in the tornado/hurricane GeoJSON exactly).
// `yearRange` is for outbreaks spanning many individual tornado records
// rather than one - the UI jumps the timeline to that range instead of
// trying to select hundreds of individual events at once.
export const FLAGSHIP_EVENTS = [
  {
    id: "2011-super-outbreak",
    title: "2011 Super Outbreak",
    type: "tornado",
    yearRange: [2011, 2011],
    blurb:
      "April 25-28, 2011 - the largest tornado outbreak on record: 360+ confirmed tornadoes across the southern and eastern US in four days, including several EF5s.",
    links: [
      { label: "NWS Birmingham event summary", url: "https://www.weather.gov/bmx/event_04272011" },
    ],
  },
  {
    id: "hur-al122005",
    title: "Hurricane Katrina (2005)",
    type: "hurricane",
    eventId: "hur-al122005",
    yearRange: [2005, 2005],
    blurb:
      "Category 5 at peak, made landfall on the Gulf Coast on August 29, 2005. One of the deadliest and costliest hurricanes in US history.",
    links: [
      {
        label: "NHC Tropical Cyclone Report (PDF)",
        url: "https://www.nhc.noaa.gov/data/tcr/AL122005_Katrina.pdf",
      },
    ],
  },
  {
    id: "joplin-2011",
    title: "Joplin, Missouri Tornado (2011)",
    type: "tornado",
    yearRange: [2011, 2011],
    blurb:
      "May 22, 2011 - an EF5 that tore through Joplin, killing 158. The deadliest single US tornado since modern record-keeping began in 1950, and the costliest tornado in US history.",
    links: [
      { label: "NWS event summary", url: "https://www.weather.gov/news/052212-joplin" },
      {
        label: "NWS Service Assessment (PDF)",
        url: "https://www.weather.gov/media/publications/assessments/Joplin_tornado.pdf",
      },
    ],
  },
  {
    id: "el-reno-2013",
    title: "El Reno, Oklahoma Tornado (2013)",
    type: "tornado",
    yearRange: [2013, 2013],
    blurb:
      "May 31, 2013 - the widest tornado ever recorded, at 2.6 miles across. Rain-wrapped and erratic, it killed several experienced storm chasers, a sobering moment for the whole chasing community.",
    links: [
      { label: "NWS Norman event page", url: "https://w2.weather.gov/oun/events-20130531-elreno" },
    ],
  },
  {
    id: "hur-al142018",
    title: "Hurricane Michael (2018)",
    type: "hurricane",
    eventId: "hur-al142018",
    yearRange: [2018, 2018],
    blurb:
      "Made landfall near Mexico Beach, FL on October 10, 2018 at Category 5 intensity - the first Cat 5 on record to hit the Florida Panhandle, and the most intense hurricane on record to strike the US in October.",
    links: [
      {
        label: "NHC Tropical Cyclone Report (PDF)",
        url: "https://www.nhc.noaa.gov/data/tcr/AL142018_Michael.pdf",
      },
    ],
  },
];
