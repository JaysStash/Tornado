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
];
