/**
 * ISO-3166 country + subdivision constants for the AdminLocationsTab picker.
 *
 * Scope is deliberately narrow: countries Beacon actually operates in (Army
 * Medicine footprint per the locations seed) plus NATO/EUCOM coverage that's
 * likely to be added next. Adding a new country = add a row here.
 *
 * Each country lists its ISO-3166-2 subdivisions (state/region/prefecture
 * codes WITHOUT the country prefix — same shape as the locations.subdivision
 * column). Subdivisions are optional in the picker (some locations don't have
 * a meaningful subdivision); pickers should treat empty subdivision list as
 * "no subdivision dropdown" rather than blocking.
 */

export interface Iso3166Country {
  /** ISO-3166-1 alpha-2 code. */
  code: string
  name: string
  /** ISO-3166-2 subcodes WITHOUT country prefix, name-keyed for picker display. */
  subdivisions: Array<{ code: string; name: string }>
}

export const ISO_COUNTRIES: Iso3166Country[] = [
  {
    code: 'US',
    name: 'United States',
    subdivisions: [
      { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' },
      { code: 'AZ', name: 'Arizona' }, { code: 'AR', name: 'Arkansas' },
      { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
      { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' },
      { code: 'DC', name: 'District of Columbia' }, { code: 'FL', name: 'Florida' },
      { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' },
      { code: 'ID', name: 'Idaho' }, { code: 'IL', name: 'Illinois' },
      { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
      { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' },
      { code: 'LA', name: 'Louisiana' }, { code: 'ME', name: 'Maine' },
      { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
      { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' },
      { code: 'MS', name: 'Mississippi' }, { code: 'MO', name: 'Missouri' },
      { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
      { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' },
      { code: 'NJ', name: 'New Jersey' }, { code: 'NM', name: 'New Mexico' },
      { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
      { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' },
      { code: 'OK', name: 'Oklahoma' }, { code: 'OR', name: 'Oregon' },
      { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
      { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' },
      { code: 'TN', name: 'Tennessee' }, { code: 'TX', name: 'Texas' },
      { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
      { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' },
      { code: 'WV', name: 'West Virginia' }, { code: 'WI', name: 'Wisconsin' },
      { code: 'WY', name: 'Wyoming' },
      { code: 'PR', name: 'Puerto Rico' }, { code: 'GU', name: 'Guam' },
    ],
  },
  {
    code: 'DE',
    name: 'Germany',
    subdivisions: [
      { code: 'BW', name: 'Baden-Württemberg' },
      { code: 'BY', name: 'Bavaria' },
      { code: 'BE', name: 'Berlin' },
      { code: 'BB', name: 'Brandenburg' },
      { code: 'HB', name: 'Bremen' },
      { code: 'HH', name: 'Hamburg' },
      { code: 'HE', name: 'Hesse' },
      { code: 'MV', name: 'Mecklenburg-Vorpommern' },
      { code: 'NI', name: 'Lower Saxony' },
      { code: 'NW', name: 'North Rhine-Westphalia' },
      { code: 'RP', name: 'Rhineland-Palatinate' },
      { code: 'SL', name: 'Saarland' },
      { code: 'SN', name: 'Saxony' },
      { code: 'ST', name: 'Saxony-Anhalt' },
      { code: 'SH', name: 'Schleswig-Holstein' },
      { code: 'TH', name: 'Thuringia' },
    ],
  },
  {
    code: 'IT',
    name: 'Italy',
    subdivisions: [
      { code: '21', name: 'Piedmont' }, { code: '23', name: "Aosta Valley" },
      { code: '25', name: 'Lombardy' }, { code: '32', name: 'Trentino-Alto Adige' },
      { code: '34', name: 'Veneto' }, { code: '36', name: 'Friuli-Venezia Giulia' },
      { code: '42', name: 'Liguria' }, { code: '45', name: 'Emilia-Romagna' },
      { code: '52', name: 'Tuscany' }, { code: '55', name: 'Umbria' },
      { code: '57', name: 'Marche' }, { code: '62', name: 'Lazio' },
      { code: '65', name: 'Abruzzo' }, { code: '67', name: 'Molise' },
      { code: '72', name: 'Campania' }, { code: '75', name: 'Apulia' },
      { code: '77', name: 'Basilicata' }, { code: '78', name: 'Calabria' },
      { code: '82', name: 'Sicily' }, { code: '88', name: 'Sardinia' },
    ],
  },
  {
    code: 'BE',
    name: 'Belgium',
    subdivisions: [
      { code: 'BRU', name: 'Brussels-Capital Region' },
      { code: 'VLG', name: 'Flemish Region' },
      { code: 'WAL', name: 'Walloon Region' },
      { code: 'WHT', name: 'Hainaut' },
    ],
  },
  {
    code: 'NL',
    name: 'Netherlands',
    subdivisions: [
      { code: 'DR', name: 'Drenthe' }, { code: 'FL', name: 'Flevoland' },
      { code: 'FR', name: 'Friesland' }, { code: 'GE', name: 'Gelderland' },
      { code: 'GR', name: 'Groningen' }, { code: 'LI', name: 'Limburg' },
      { code: 'NB', name: 'North Brabant' }, { code: 'NH', name: 'North Holland' },
      { code: 'OV', name: 'Overijssel' }, { code: 'UT', name: 'Utrecht' },
      { code: 'ZE', name: 'Zeeland' }, { code: 'ZH', name: 'South Holland' },
    ],
  },
  {
    code: 'PL',
    name: 'Poland',
    subdivisions: [
      { code: 'DS', name: 'Lower Silesia' }, { code: 'KP', name: 'Kuyavia-Pomerania' },
      { code: 'LU', name: 'Lublin' }, { code: 'LB', name: 'Lubusz' },
      { code: 'LD', name: 'Łódź' }, { code: 'MA', name: 'Lesser Poland' },
      { code: 'MZ', name: 'Masovia' }, { code: 'OP', name: 'Opole' },
      { code: 'PK', name: 'Subcarpathia' }, { code: 'PD', name: 'Podlachia' },
      { code: 'PM', name: 'Pomerania' }, { code: 'SL', name: 'Silesia' },
      { code: 'SK', name: 'Holy Cross' }, { code: 'WN', name: 'Warmia-Masuria' },
      { code: 'WP', name: 'Greater Poland' }, { code: 'ZP', name: 'West Pomerania' },
    ],
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    subdivisions: [
      { code: 'ENG', name: 'England' }, { code: 'SCT', name: 'Scotland' },
      { code: 'WLS', name: 'Wales' }, { code: 'NIR', name: 'Northern Ireland' },
    ],
  },
  {
    code: 'KR',
    name: 'South Korea',
    subdivisions: [
      { code: '11', name: 'Seoul' }, { code: '26', name: 'Busan' },
      { code: '27', name: 'Daegu' }, { code: '28', name: 'Incheon' },
      { code: '29', name: 'Gwangju' }, { code: '30', name: 'Daejeon' },
      { code: '31', name: 'Ulsan' }, { code: '41', name: 'Gyeonggi' },
      { code: '42', name: 'Gangwon' }, { code: '43', name: 'North Chungcheong' },
      { code: '44', name: 'South Chungcheong' }, { code: '45', name: 'North Jeolla' },
      { code: '46', name: 'South Jeolla' }, { code: '47', name: 'North Gyeongsang' },
      { code: '48', name: 'South Gyeongsang' }, { code: '49', name: 'Jeju' },
    ],
  },
  {
    code: 'JP',
    name: 'Japan',
    subdivisions: [
      { code: '13', name: 'Tokyo' }, { code: '14', name: 'Kanagawa' },
      { code: '23', name: 'Aichi' }, { code: '27', name: 'Osaka' },
      { code: '40', name: 'Fukuoka' }, { code: '47', name: 'Okinawa' },
    ],
  },
  {
    code: 'KW',
    name: 'Kuwait',
    subdivisions: [
      { code: 'AH', name: 'Al Ahmadi' }, { code: 'FA', name: 'Al Farwaniyah' },
      { code: 'JA', name: 'Al Jahra' }, { code: 'KU', name: 'Capital' },
      { code: 'HA', name: 'Hawalli' }, { code: 'MU', name: 'Mubarak Al-Kabeer' },
    ],
  },
  {
    code: 'RO',
    name: 'Romania',
    subdivisions: [
      { code: 'CT', name: 'Constanța' }, { code: 'B', name: 'Bucharest' },
    ],
  },
  {
    code: 'BG',
    name: 'Bulgaria',
    subdivisions: [],
  },
  {
    code: 'EE',
    name: 'Estonia',
    subdivisions: [],
  },
  {
    code: 'LV',
    name: 'Latvia',
    subdivisions: [],
  },
  {
    code: 'LT',
    name: 'Lithuania',
    subdivisions: [],
  },
]

const COUNTRY_BY_CODE = new Map(ISO_COUNTRIES.map(c => [c.code, c]))

export function findCountry(code: string | null | undefined): Iso3166Country | null {
  if (!code) return null
  return COUNTRY_BY_CODE.get(code) ?? null
}

export function findSubdivisionName(countryCode: string | null, subdivisionCode: string | null): string | null {
  const country = findCountry(countryCode)
  if (!country || !subdivisionCode) return null
  return country.subdivisions.find(s => s.code === subdivisionCode)?.name ?? null
}

/**
 * Canonical commands seen across the existing seed. Form uses these as
 * dropdown options + an "Other (text)" escape for one-off entries.
 */
export const COMMAND_OPTIONS = [
  'FORSCOM',
  'TRADOC',
  'MEDCOM',
  'IMCOM',
  'AMC',
  'USAREUR-AF',
  'USARPAC',
  'USARJ',
  'USFK',
  'ARCENT',
  'ARNORTH',
  'ARSOUTH',
  'NETCOM',
] as const

export type CommandOption = typeof COMMAND_OPTIONS[number]
