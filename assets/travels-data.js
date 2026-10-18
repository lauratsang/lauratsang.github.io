// MapTiler basemap configuration. Use a public, domain-restricted key.
window.TRAVEL_MAP_CONFIG = {
  basemapProvider: 'maptiler',
  basemapKey: 'a3s9nJT6ZSGNi5gYPEOE',
  basemapStyle: 'dataviz-v4'
};

// Add places here to publish pins for every visitor. Coordinates: latitude, longitude.
// { name: 'Place', coordinates: [latitude, longitude], date: 'Month Year', note: 'A little story.' }
window.TRAVEL_PLACES = [{
  name: 'Home · Providence, RI',
  continent: 'North America',
  // Public park location, not a home address.
  coordinates: [41.8176, -71.3926],
  type: 'home',
  note: "I'm in Providence, RI for now! Took this photo of sunset at India Point Park lighting the sky on fire.",
  photo: 'assets/images/travels/india-point-sunset.jpg',
  photoAlt: 'An orange sunset over the water at India Point Park in Providence.'
}];

// One reflection per route. Separate paragraphs with a blank line.
window.TRAVEL_REFLECTIONS = {
  'Acadia-Beehive.gpx': "Hiked the Beehive at 6am and there was hardly anyone around. We collected some wild blueberries as a snack. My first time really camping!",
  'ArthursSeat_Afternoon_Hike.gpx': "The best view of the city, as they all say. It was pretty crowded and steep especially since we followed Isa up a crazy way. Wish they didn't have the oil refineries in the distance ruining the skyline.",
  'Glymur_Morning_Hike.gpx': "This hike was one of the most beautiful hikes I've ever done. We had two water crossings in the ice cold river and the current was incredibly strong from the waterfall and the recent rain in Iceland. Would love to come back and drive the perimeter in a camper van."
};
