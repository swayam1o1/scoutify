/**
 * Approximate coordinates for major Indian cities, used to turn a client's
 * shared geo location into a city name (vendors only store city text).
 */
const CITIES = [
  ['Mumbai', 19.076, 72.8777], ['Delhi', 28.6139, 77.209], ['Bangalore', 12.9716, 77.5946],
  ['Hyderabad', 17.385, 78.4867], ['Chennai', 13.0827, 80.2707], ['Kolkata', 22.5726, 88.3639],
  ['Pune', 18.5204, 73.8567], ['Ahmedabad', 23.0225, 72.5714], ['Jaipur', 26.9124, 75.7873],
  ['Surat', 21.1702, 72.8311], ['Lucknow', 26.8467, 80.9462], ['Kanpur', 26.4499, 80.3319],
  ['Nagpur', 21.1458, 79.0882], ['Indore', 22.7196, 75.8577], ['Bhopal', 23.2599, 77.4126],
  ['Visakhapatnam', 17.6868, 83.2185], ['Patna', 25.5941, 85.1376], ['Vadodara', 22.3072, 73.1812],
  ['Ghaziabad', 28.6692, 77.4538], ['Noida', 28.5355, 77.391], ['Gurgaon', 28.4595, 77.0266],
  ['Faridabad', 28.4089, 77.3178], ['Ludhiana', 30.901, 75.8573], ['Agra', 27.1767, 78.0081],
  ['Nashik', 19.9975, 73.7898], ['Rajkot', 22.3039, 70.8022], ['Varanasi', 25.3176, 82.9739],
  ['Srinagar', 34.0837, 74.7973], ['Amritsar', 31.634, 74.8723], ['Chandigarh', 30.7333, 76.7794],
  ['Coimbatore', 11.0168, 76.9558], ['Kochi', 9.9312, 76.2673], ['Thiruvananthapuram', 8.5241, 76.9366],
  ['Mysore', 12.2958, 76.6394], ['Mangalore', 12.9141, 74.856], ['Madurai', 9.9252, 78.1198],
  ['Tirupati', 13.6288, 79.4192], ['Vijayawada', 16.5062, 80.648], ['Guwahati', 26.1445, 91.7362],
  ['Bhubaneswar', 20.2961, 85.8245], ['Raipur', 21.2514, 81.6296], ['Ranchi', 23.3441, 85.3096],
  ['Dehradun', 30.3165, 78.0322], ['Goa', 15.4909, 73.8278], ['Udaipur', 24.5854, 73.7125],
  ['Jodhpur', 26.2389, 73.0243]
];

const ALIASES = {
  bengaluru: 'bangalore',
  'new delhi': 'delhi',
  gurugram: 'gurgaon',
  mysuru: 'mysore',
  mangaluru: 'mangalore',
  cochin: 'kochi',
  trivandrum: 'thiruvananthapuram',
  vizag: 'visakhapatnam',
  panaji: 'goa',
  bombay: 'mumbai',
  madras: 'chennai',
  calcutta: 'kolkata'
};

const MAX_NEAREST_KM = 75;

function normalizeCity(value) {
  const key = String(value || '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  return ALIASES[key] || key;
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const toRad = deg => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

function nearestCity(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  let best = null;
  for (const [name, cityLat, cityLng] of CITIES) {
    const km = distanceKm(lat, lng, cityLat, cityLng);
    if (!best || km < best.km) best = { name, km };
  }
  return best && best.km <= MAX_NEAREST_KM ? best.name : null;
}

module.exports = { normalizeCity, nearestCity, distanceKm };
