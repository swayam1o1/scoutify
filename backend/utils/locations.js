/**
 * Location matching for search. Listings store a free-text city ("Chennai", "Pune & Mumbai"),
 * so a state typed by the client ("Tamil Nadu") is expanded to that state's cities.
 */

// First entry is the state name; aliases and cities follow. Matching is case-insensitive substring.
const STATES = [
  { names: ['andhra pradesh', 'andhra'], cities: ['visakhapatnam', 'vizag', 'vijayawada', 'guntur', 'nellore', 'tirupati', 'kurnool', 'kakinada', 'rajahmundry', 'rajamahendravaram', 'anantapur', 'kadapa', 'eluru', 'ongole', 'chittoor', 'srikakulam', 'vizianagaram', 'amaravati', 'machilipatnam', 'tenali', 'proddatur', 'bhimavaram'] },
  { names: ['arunachal pradesh', 'arunachal'], cities: ['itanagar', 'tawang', 'pasighat'] },
  { names: ['assam'], cities: ['guwahati', 'dibrugarh', 'silchar', 'jorhat', 'tezpur', 'nagaon', 'tinsukia', 'bongaigaon'] },
  { names: ['bihar'], cities: ['patna', 'gaya', 'bhagalpur', 'muzaffarpur', 'darbhanga', 'purnia', 'kishanganj', 'arrah', 'begusarai', 'hajipur'] },
  { names: ['chhattisgarh', 'chhatisgarh', 'chattisgarh'], cities: ['raipur', 'bhilai', 'bilaspur', 'durg', 'korba', 'rajnandgaon', 'jagdalpur'] },
  { names: ['goa'], cities: ['panaji', 'panjim', 'margao', 'madgaon', 'vasco', 'mapusa', 'ponda', 'calangute', 'porvorim'] },
  { names: ['gujarat', 'gujrat'], cities: ['ahmedabad', 'surat', 'vadodara', 'baroda', 'rajkot', 'gandhinagar', 'bhavnagar', 'jamnagar', 'junagadh', 'anand', 'navsari', 'morbi', 'vapi', 'bharuch', 'mehsana', 'valsad', 'gandhidham', 'bhuj'] },
  { names: ['haryana'], cities: ['gurgaon', 'gurugram', 'faridabad', 'panipat', 'sonipat', 'ambala', 'karnal', 'hisar', 'rohtak', 'panchkula', 'yamunanagar', 'kurukshetra', 'rewari', 'bahadurgarh', 'fatehabad', 'dabwali'] },
  { names: ['himachal pradesh', 'himachal'], cities: ['shimla', 'manali', 'dharamshala', 'solan', 'mandi', 'kullu', 'baddi', 'palampur', 'dalhousie'] },
  { names: ['jharkhand'], cities: ['ranchi', 'jamshedpur', 'dhanbad', 'bokaro', 'hazaribagh', 'deoghar'] },
  { names: ['karnataka'], cities: ['bangalore', 'bengaluru', 'mysore', 'mysuru', 'mangalore', 'mangaluru', 'hubli', 'hubballi', 'dharwad', 'belgaum', 'belagavi', 'davangere', 'davanagere', 'shimoga', 'shivamogga', 'udupi', 'tumkur', 'gulbarga', 'kalaburagi', 'bellary', 'hassan', 'manipal'] },
  { names: ['kerala'], cities: ['kochi', 'cochin', 'ernakulam', 'thiruvananthapuram', 'trivandrum', 'kozhikode', 'calicut', 'thrissur', 'kollam', 'kannur', 'alappuzha', 'alleppey', 'kottayam', 'palakkad', 'malappuram', 'kasaragod', 'pathanamthitta'] },
  { names: ['madhya pradesh'], cities: ['indore', 'bhopal', 'jabalpur', 'gwalior', 'ujjain', 'sagar', 'katni', 'satna', 'rewa', 'ratlam', 'dewas', 'chhindwara', 'khargone'] },
  { names: ['maharashtra'], cities: ['mumbai', 'bombay', 'pune', 'nagpur', 'nashik', 'thane', 'navi mumbai', 'aurangabad', 'solapur', 'kolhapur', 'amravati', 'nanded', 'sangli', 'satara', 'jalgaon', 'akola', 'latur', 'ahmednagar', 'lonavala', 'panvel', 'kalyan', 'vasai', 'virar', 'sambhajinagar', 'sambhaji nagar', 'pimpri', 'chinchwad', 'vashi', 'khopoli', 'malegaon', 'ulhasnagar', 'bhusawal', 'nandura', 'ratnagiri'] },
  { names: ['manipur'], cities: ['imphal'] },
  { names: ['meghalaya'], cities: ['shillong', 'tura'] },
  { names: ['mizoram'], cities: ['aizawl'] },
  { names: ['nagaland'], cities: ['kohima', 'dimapur'] },
  { names: ['odisha', 'orissa'], cities: ['bhubaneswar', 'cuttack', 'rourkela', 'puri', 'sambalpur', 'berhampur', 'brahmapur', 'balasore'] },
  { names: ['punjab'], cities: ['ludhiana', 'amritsar', 'jalandhar', 'patiala', 'bathinda', 'mohali', 'pathankot', 'hoshiarpur', 'zirakpur', 'khanna', 'qadian', 'gobindgarh', 'tarn taran', 'muktsar'] },
  { names: ['rajasthan'], cities: ['jaipur', 'jodhpur', 'udaipur', 'kota', 'ajmer', 'bikaner', 'alwar', 'bhilwara', 'sikar', 'jaisalmer', 'pushkar', 'mount abu', 'makrana', 'kishangarh', 'dholpur'] },
  { names: ['sikkim'], cities: ['gangtok'] },
  { names: ['tamil nadu', 'tamilnadu'], cities: ['chennai', 'madras', 'coimbatore', 'madurai', 'trichy', 'tiruchirappalli', 'tiruchirapalli', 'salem', 'tirunelveli', 'erode', 'vellore', 'thoothukudi', 'tuticorin', 'tiruppur', 'tirupur', 'thanjavur', 'hosur', 'kanchipuram', 'nagercoil', 'karaikudi', 'ooty', 'kumbakonam', 'dindigul', 'karur', 'namakkal', 'pollachi', 'kodaikanal', 'mahabalipuram', 'chengalpattu', 'theni'] },
  { names: ['telangana'], cities: ['hyderabad', 'secunderabad', 'warangal', 'karimnagar', 'nizamabad', 'khammam', 'mahbubnagar', 'nalgonda', 'adilabad', 'siddipet', 'gachibowli', 'kondapur', 'kukatpally'] },
  { names: ['tripura'], cities: ['agartala'] },
  { names: ['uttar pradesh'], cities: ['lucknow', 'noida', 'greater noida', 'ghaziabad', 'kanpur', 'agra', 'varanasi', 'prayagraj', 'allahabad', 'meerut', 'aligarh', 'bareilly', 'moradabad', 'gorakhpur', 'mathura', 'jhansi', 'ayodhya', 'bhadohi', 'rampur'] },
  { names: ['uttarakhand'], cities: ['dehradun', 'haridwar', 'rishikesh', 'nainital', 'haldwani', 'roorkee', 'mussoorie', 'rudrapur', 'kashipur'] },
  { names: ['west bengal', 'bengal'], cities: ['kolkata', 'calcutta', 'howrah', 'durgapur', 'asansol', 'siliguri', 'darjeeling', 'kharagpur', 'bardhaman', 'kalimpong'] },
  { names: ['delhi', 'new delhi', 'ncr'], cities: ['new delhi', 'dwarka', 'rohini', 'saket', 'noida', 'gurgaon', 'gurugram', 'faridabad', 'ghaziabad'] },
  { names: ['chandigarh'], cities: ['chandigarh', 'mohali', 'panchkula', 'zirakpur'] },
  { names: ['puducherry', 'pondicherry'], cities: ['puducherry', 'pondicherry', 'karaikal'] },
  { names: ['jammu and kashmir', 'jammu & kashmir', 'kashmir'], cities: ['srinagar', 'jammu'] }
];

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z& ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function stateFor(location) {
  const query = normalize(location);
  return STATES.find(state => state.names.includes(query)) || null;
}

/** Regex source matching the typed location, plus the state's cities when it is a state. */
function locationPattern(location) {
  const typed = String(location || '').trim();
  if (!typed) return null;
  const state = stateFor(typed);
  const terms = state ? [typed, ...state.names, ...state.cities] : [typed];
  return [...new Set(terms)].map(escapeRegex).join('|');
}

/** Mongo condition on city or service area; null when no location was given. */
function locationFilter(location) {
  const pattern = locationPattern(location);
  if (!pattern) return null;
  const regex = { $regex: pattern, $options: 'i' };
  return { $or: [{ city: regex }, { serviceArea: regex }] };
}

/** State or city named in free text, longest name first: "architects in Tamil Nadu" → "Tamil Nadu". */
function findLocation(text) {
  const query = ` ${normalize(text)} `;
  const found = STATES
    .flatMap(state => [...state.names, ...state.cities])
    .filter(name => query.includes(` ${name} `))
    .sort((left, right) => right.length - left.length)[0];
  return found ? found.replace(/\b[a-z]/g, letter => letter.toUpperCase()) : '';
}

module.exports = { locationFilter, locationPattern, stateFor, findLocation };
