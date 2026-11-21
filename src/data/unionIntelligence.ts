import { Proposal, getCanonicalUnion, getCanonicalKpiType } from '../types';
import { parseKpiTargetNumber } from '../utils/kpiExtraction';

export interface PlatformStat {
  platform: string;
  reach: string;
  notes?: string;
}

export interface UnreachedPeopleGroupSummary {
  name: string;
  country: string;
  population: number;
  primaryReligion: string;
  language: string;
  isFrontier: boolean;
  jpScale: number; // 1 = Unreached, 2 = Minimally Reached
  notes?: string;
}

export interface CountryDigitalAndFreedomProfile {
  country: string;
  internetPenetrationPct: number;
  offlinePopulationPct: number;
  offlinePopulationLabel: string;
  medianAge: number;
  urbanPct: number;
  mobileSpeedMbps?: number;
  fixedSpeedMbps?: number;
  globalFreedomScore?: number; // out of 100
  globalFreedomStatus?: 'Free' | 'Partly Free' | 'Not Free';
  netFreedomScore?: number; // out of 100
  netFreedomStatus?: 'Free' | 'Partly Free' | 'Not Free';
  religiousFreedomScore?: number; // 0 to 4 (Freedom House D1)
  topPlatforms: PlatformStat[];
  digitalStrategicNote: string;
}

export interface UnionIntelligenceProfile {
  canonicalName: string;
  acronym: string;
  category: 'Union Conference' | 'Union Mission' | 'Attached Field';
  formerName?: string;
  organizedHistory: string;
  countries: string[];
  territoryDescription: string;
  constituentFields: string[];
  churches: number;
  membership: number;
  population: number;
  memberToPopRatio: number; // 1 Adventist per X people
  avgMembersPerChurch: number;
  streetAddress: string;
  mailingAddress?: string;
  website?: string;
  socialLinks: {
    facebook?: string[];
    instagram?: string;
    youtube?: string;
    x?: string;
  };
  // Synthesized Digital & Freedom Intelligence across the Union's countries
  avgInternetPenetrationPct: number;
  offlinePopulationSummary: string;
  isHighOfflineTerritory: boolean; // >= 25% offline or >= 25M offline
  isSensitiveTerritory: boolean; // Religious Freedom <= 1/4 or Net Freedom Not Free
  sensitivityLevel: 'Open' | 'Moderated' | 'Sensitive (Play 7 Required)';
  sensitivitySummary: string;
  topPlatformsSummary: PlatformStat[];
  countryProfiles: CountryDigitalAndFreedomProfile[];
  keyPeopleGroups: UnreachedPeopleGroupSummary[];
  totalPeopleGroupsCount: number;
  leastReachedGroupsCount: number;
  livingLanguagesCount: number;
  primaryLanguagesSummary: string;
}

export const COUNTRY_INTELLIGENCE: Record<string, CountryDigitalAndFreedomProfile> = {
  Philippines: {
    country: 'Philippines',
    internetPenetrationPct: 86.3,
    offlinePopulationPct: 13.7,
    offlinePopulationLabel: '16.1M offline (13.7%)',
    medianAge: 26.1,
    urbanPct: 49.3,
    mobileSpeedMbps: 61.95,
    fixedSpeedMbps: 105.09,
    globalFreedomScore: 58,
    globalFreedomStatus: 'Partly Free',
    netFreedomScore: 61,
    netFreedomStatus: 'Partly Free',
    religiousFreedomScore: 4,
    topPlatforms: [
      { platform: 'Facebook', reach: '95.8M', notes: 'Primary community & church page hub' },
      { platform: 'Messenger', reach: '65.8M', notes: 'Primary 1-on-1 seeker response channel' },
      { platform: 'TikTok', reach: '64.0M', notes: 'High youth & young adult short-form reach' },
      { platform: 'YouTube', reach: '59.6M', notes: 'Long-form study & broadcast streaming' },
      { platform: 'Instagram', reach: '26.9M', notes: 'Urban youth & young professional segment' },
    ],
    digitalStrategicNote:
      'High social media usage with open religious expression (4/4). Messenger and Facebook Groups are essential for moving short-form viewers into local church small groups.',
  },
  Indonesia: {
    country: 'Indonesia',
    internetPenetrationPct: 80.5,
    offlinePopulationPct: 19.5,
    offlinePopulationLabel: '55.82M offline (19.5%)',
    medianAge: 30.4,
    urbanPct: 59.1,
    globalFreedomScore: 56,
    globalFreedomStatus: 'Partly Free',
    netFreedomScore: 48,
    netFreedomStatus: 'Partly Free',
    religiousFreedomScore: 1,
    topPlatforms: [
      { platform: 'WhatsApp', reach: '85%+ of users', notes: 'Dominant private follow-up & care channel' },
      { platform: 'YouTube', reach: '139M+', notes: 'Leading video discovery platform' },
      { platform: 'TikTok', reach: '125M+', notes: 'Fastest-growing short-form reach' },
      { platform: 'Instagram', reach: '100M+', notes: 'Strong urban & student engagement' },
      { platform: 'Facebook', reach: '115M+', notes: 'Broad regional & family community reach' },
    ],
    digitalStrategicNote:
      '230.05M internet users alongside 55.82M unconnected citizens. Religious Freedom is rated 1/4 due to strict blasphemy laws—Group D/E outreach requires respectful cultural framing and private WhatsApp opt-in routing (Playbook Play 7).',
  },
  Malaysia: {
    country: 'Malaysia',
    internetPenetrationPct: 98.2,
    offlinePopulationPct: 1.8,
    offlinePopulationLabel: '637K offline (1.8%)',
    medianAge: 31.4,
    urbanPct: 77.2,
    mobileSpeedMbps: 141.75,
    fixedSpeedMbps: 158.5,
    globalFreedomScore: 53,
    globalFreedomStatus: 'Partly Free',
    netFreedomScore: 60,
    netFreedomStatus: 'Partly Free',
    religiousFreedomScore: 1,
    topPlatforms: [
      { platform: 'YouTube', reach: '23.6M', notes: '65.3% of total population' },
      { platform: 'Facebook', reach: '23.0M', notes: '63.6% of total population' },
      { platform: 'TikTok', reach: '20.7M', notes: '76.1% of adults 18+' },
      { platform: 'Instagram', reach: '16.1M', notes: '44.5% of total population' },
      { platform: 'Messenger', reach: '11.4M', notes: 'Direct response & community chat' },
    ],
    digitalStrategicNote:
      'Near-universal connectivity (98.2%) and ultra-fast mobile speeds (141.8 Mbps). Religious Freedom is 1/4 with legal restrictions on proselytizing majority-religion citizens—requires Playbook Play 7 private, consented dialogue.',
  },
  Brunei: {
    country: 'Brunei Darussalam',
    internetPenetrationPct: 98.0,
    offlinePopulationPct: 2.0,
    offlinePopulationLabel: '<10K offline (2.0%)',
    medianAge: 32.3,
    urbanPct: 79.0,
    globalFreedomScore: 27,
    globalFreedomStatus: 'Not Free',
    religiousFreedomScore: 1,
    topPlatforms: [
      { platform: 'Instagram', reach: 'High urban reach', notes: 'Primary visual social channel' },
      { platform: 'WhatsApp', reach: 'Primary messaging', notes: 'Private relationship building' },
      { platform: 'Facebook', reach: 'Broad adult reach', notes: 'Community updates' },
    ],
    digitalStrategicNote:
      'Strict religious regulations (Religious Freedom 1/4, Global Score 27/100 Not Free). Focus on personal wellness, family resilience, and private consented fellowship (Playbook Play 7).',
  },
  Myanmar: {
    country: 'Myanmar',
    internetPenetrationPct: 72.5,
    offlinePopulationPct: 27.5,
    offlinePopulationLabel: '15.1M offline (27.5%)',
    medianAge: 29.8,
    urbanPct: 34.6,
    mobileSpeedMbps: 26.86,
    fixedSpeedMbps: 25.19,
    globalFreedomStatus: 'Not Free',
    netFreedomStatus: 'Not Free',
    religiousFreedomScore: 1,
    topPlatforms: [
      { platform: 'TikTok', reach: '21.0M', notes: '53.4% of adults 18+ (unaffected by Meta blocks)' },
      { platform: 'Facebook', reach: '13.7M', notes: '24.9% of pop (restricted by VPN blocks)' },
      { platform: 'Messenger', reach: '8.20M', notes: '14.9% of pop' },
      { platform: 'Instagram', reach: '1.85M', notes: '3.4% of pop' },
    ],
    digitalStrategicNote:
      '65.4% rural population and 27.5% offline (15.1M people). Authorities actively block Facebook/Instagram and VPNs, shifting massive organic reach to TikTok (21.0M) alongside offline/community channels.',
  },
  Thailand: {
    country: 'Thailand',
    internetPenetrationPct: 94.6,
    offlinePopulationPct: 5.4,
    offlinePopulationLabel: '3.87M offline (5.4%)',
    medianAge: 40.9,
    urbanPct: 53.5,
    mobileSpeedMbps: 112.92,
    fixedSpeedMbps: 264.88,
    topPlatforms: [
      { platform: 'TikTok', reach: '56.6M', notes: '94.3% of adults 18+ (57.3M users)' },
      { platform: 'LINE', reach: '56.0M', notes: '82.7% of internet users — essential for follow-up' },
      { platform: 'Facebook', reach: '51.5M', notes: '71.9% of total population' },
      { platform: 'YouTube', reach: '49.7M', notes: '69.4% of total population' },
      { platform: 'Messenger', reach: '36.7M', notes: '51.3% of total population' },
    ],
    digitalStrategicNote:
      'Aging demographic (median age 40.9) with 94.6% internet penetration. TikTok (56.6M) and LINE (56.0M) are the dominant discovery and 1-on-1 care channels.',
  },
  Vietnam: {
    country: 'Vietnam',
    internetPenetrationPct: 84.6,
    offlinePopulationPct: 15.4,
    offlinePopulationLabel: '15.7M offline (15.4%)',
    medianAge: 33.7,
    urbanPct: 39.2,
    mobileSpeedMbps: 152.17,
    fixedSpeedMbps: 264.08,
    globalFreedomScore: 20,
    globalFreedomStatus: 'Not Free',
    netFreedomScore: 22,
    netFreedomStatus: 'Not Free',
    religiousFreedomScore: 1,
    topPlatforms: [
      { platform: 'Facebook', reach: '79.0M', notes: '77.6% of total population' },
      { platform: 'Zalo', reach: '78.3M', notes: '91.0% of internet users — #1 local messaging app' },
      { platform: 'TikTok', reach: '76.1M', notes: '100%+ of adult 18+ ad reach' },
      { platform: 'YouTube', reach: '62.1M', notes: '61.0% of total population' },
      { platform: 'Messenger', reach: '57.8M', notes: '56.8% of total population' },
    ],
    digitalStrategicNote:
      'High-speed connectivity (152 Mbps mobile), 60.8% rural population, and strict digital/religious oversight (Net Freedom 22/100 Not Free, Religious Freedom 1/4). Zalo (78.3M) is mandatory for warm relational follow-up.',
  },
  Cambodia: {
    country: 'Cambodia',
    internetPenetrationPct: 67.3,
    offlinePopulationPct: 32.7,
    offlinePopulationLabel: '5.87M offline (32.7%)',
    medianAge: 26.4,
    urbanPct: 26.7,
    mobileSpeedMbps: 49.49,
    fixedSpeedMbps: 48.29,
    globalFreedomScore: 22,
    globalFreedomStatus: 'Not Free',
    netFreedomScore: 42,
    netFreedomStatus: 'Partly Free',
    religiousFreedomScore: 3,
    topPlatforms: [
      { platform: 'Facebook', reach: '14.0M', notes: '78.0% of total population' },
      { platform: 'TikTok', reach: '11.3M', notes: '93.8% of adults 18+' },
      { platform: 'Messenger', reach: '8.90M', notes: '49.6% of total population' },
      { platform: 'Instagram', reach: '2.10M', notes: '11.7% of total population' },
    ],
    digitalStrategicNote:
      'Young (median age 26.4) and predominantly rural (73.3% rural) with 32.7% offline (5.87M people). Combining Facebook/TikTok video with community/radio outreach bridges the rural gap.',
  },
  Laos: {
    country: 'Laos',
    internetPenetrationPct: 63.6,
    offlinePopulationPct: 36.4,
    offlinePopulationLabel: '2.88M offline (36.4%)',
    medianAge: 25.2,
    urbanPct: 39.6,
    mobileSpeedMbps: 41.39,
    fixedSpeedMbps: 46.84,
    globalFreedomScore: 13,
    globalFreedomStatus: 'Not Free',
    religiousFreedomScore: 1,
    topPlatforms: [
      { platform: 'Facebook', reach: '4.60M', notes: '58.1% of total population' },
      { platform: 'Messenger', reach: '3.05M', notes: '38.5% of total population' },
      { platform: 'Instagram', reach: '266K', notes: '3.4% of total population' },
    ],
    digitalStrategicNote:
      'Youngest mainland SE Asia population (median age 25.2) with 36.4% offline and strict religious oversight (Global Score 13/100 Not Free, Religious Freedom 1/4). Requires Playbook Play 7 safe routing and low-bandwidth audio/video.',
  },
  Singapore: {
    country: 'Singapore',
    internetPenetrationPct: 96.0,
    offlinePopulationPct: 4.0,
    offlinePopulationLabel: '248K offline (4.0%)',
    medianAge: 43.2,
    urbanPct: 100.0,
    globalFreedomScore: 48,
    globalFreedomStatus: 'Partly Free',
    netFreedomScore: 53,
    netFreedomStatus: 'Partly Free',
    religiousFreedomScore: 3,
    topPlatforms: [
      { platform: 'WhatsApp', reach: '90%+ of users', notes: 'Primary personal & community messaging' },
      { platform: 'YouTube', reach: '5.1M+', notes: 'Primary long-form & podcast platform' },
      { platform: 'Instagram', reach: '3.8M+', notes: 'Strong young adult & professional reach' },
      { platform: 'Facebook', reach: '3.6M+', notes: 'Broad family & community reach' },
      { platform: 'TikTok', reach: '2.9M+', notes: 'Short-form discovery' },
    ],
    digitalStrategicNote:
      '100% urban, high-income secularized hub (median age 43.2) with Religious Harmony laws (Religious Freedom 3/4). Mental health, family resilience, and workplace purpose resonate strongly.',
  },
  'Timor-Leste': {
    country: 'Timor-Leste',
    internetPenetrationPct: 40.4,
    offlinePopulationPct: 59.6,
    offlinePopulationLabel: '851K offline (59.6%)',
    medianAge: 21.4,
    urbanPct: 35.5,
    mobileSpeedMbps: 4.93,
    fixedSpeedMbps: 11.49,
    topPlatforms: [
      { platform: 'Facebook', reach: '687K', notes: '48.1% of total population' },
      { platform: 'Messenger', reach: '111K', notes: '7.8% of total population' },
      { platform: 'Instagram', reach: '79.3K', notes: '5.6% of total population' },
    ],
    digitalStrategicNote:
      '59.6% of the population is offline, 64.5% is rural, median age is 21.4, and mobile speeds average just 4.93 Mbps. Radio, audio proclamation kits, printed literature, and compressed mobile assets are vital.',
  },
};

export const UNION_INTELLIGENCE_PROFILES: Record<string, UnionIntelligenceProfile> = {
  'Northern Luzon Philippine Union Mission': {
    canonicalName: 'Northern Luzon Philippine Union Mission',
    acronym: 'NLPUM',
    category: 'Union Mission',
    formerName: 'North Philippine Union Conference',
    organizedHistory:
      'Organized 1917; reorganized 1951, 2009, 2017, 2019; reorganized, renamed, and territory divided 2024',
    countries: ['Philippines'],
    territoryDescription:
      '23 Provinces in Northern & Central Luzon (Abra, Apayao, Aurora, Bataan, Batanes, Benguet, Bulacan, Cagayan, Ifugao, Ilocos Norte, Ilocos Sur, Isabela, Kalinga, La Union, Mountain Province, Nueva Ecija, Nueva Vizcaya, Pampanga, Pangasinan, Quirino, Rizal, Tarlac, Zambales) and the National Capital Region (Metro Manila).',
    constituentFields: [
      'Central Luzon Conference',
      'Central Luzon Provinces Mission',
      'Mountain Provinces Mission',
      'Northeast Luzon Mission',
      'Northern Luzon Mission',
    ],
    churches: 927,
    membership: 122207,
    population: 42289196,
    memberToPopRatio: 346,
    avgMembersPerChurch: 132,
    streetAddress: '210 San Juan Street, Corner Donada, 1300 Pasay City, Philippines',
    mailingAddress: 'P.O. Box 401, 1099 Manila, Philippines',
    website: 'https://npuc.adventist.ph',
    socialLinks: {
      facebook: [
        'https://www.facebook.com/adventist.npuc',
        'https://www.facebook.com/hopechannelluzon',
      ],
      instagram: 'https://www.instagram.com/adventist.northph',
      youtube: 'https://www.youtube.com/@hopechannelnorthphilippines',
    },
    avgInternetPenetrationPct: 86.3,
    offlinePopulationSummary: '13.7% offline across PH (higher in Cordillera & Sierra Madre mountain areas)',
    isHighOfflineTerritory: false,
    isSensitiveTerritory: false,
    sensitivityLevel: 'Open',
    sensitivitySummary:
      'Open religious freedom (4/4). High urban density in Metro Manila (NCR) paired with indigenous Cordillera and Ilocano/Kapampangan/Tagalog linguistic diversity.',
    topPlatformsSummary: COUNTRY_INTELLIGENCE.Philippines.topPlatforms,
    countryProfiles: [COUNTRY_INTELLIGENCE.Philippines],
    totalPeopleGroupsCount: 68,
    leastReachedGroupsCount: 6,
    livingLanguagesCount: 62,
    primaryLanguagesSummary: 'Tagalog, Ilocano, Kapampangan, Pangasinan, Cordilleran',
    keyPeopleGroups: [
      {
        name: 'Secular & Unchurched Metro Manila Professionals / Gen Z',
        country: 'Philippines',
        population: 14000000,
        primaryReligion: 'Secular / Nominal Christian',
        language: 'Tagalog / English',
        isFrontier: false,
        jpScale: 2,
        notes: 'High digital screen time in NCR; responsive to mental health, financial peace, and short-form video.',
      },
      {
        name: 'Chinese (Hokkien / Mandarin) in Metro Manila',
        country: 'Philippines',
        population: 1250000,
        primaryReligion: 'Buddhism / Traditional Chinese Religion',
        language: 'Hokkien / Mandarin / English',
        isFrontier: false,
        jpScale: 1,
        notes: 'Concentrated in Binondo, Quezon City, and commercial centers; least-reached urban segment.',
      },
      {
        name: 'Cordillera Indigenous Communities (Ifugao, Kalinga, Bontoc)',
        country: 'Philippines',
        population: 1800000,
        primaryReligion: 'Ethnic Religions / Christianity',
        language: 'Ilocano / Igorot dialects',
        isFrontier: false,
        jpScale: 2,
        notes: 'Mountain Provinces Mission territory; benefits from vernaculuar audio/radio + community health.',
      },
    ],
  },

  'Southern Luzon Philippine Union Mission': {
    canonicalName: 'Southern Luzon Philippine Union Mission',
    acronym: 'SLPUM',
    category: 'Union Mission',
    formerName: 'Part of North Philippine Union Conference',
    organizedHistory: 'Organized 2025',
    countries: ['Philippines'],
    territoryDescription:
      'Provinces of Albay, Batangas, Camarines Norte, Camarines Sur, Catanduanes, Cavite, Laguna, Marinduque, Masbate, Sorsogon, Quezon, Occidental Mindoro, Oriental Mindoro, and Palawan.',
    constituentFields: [
      'South-Central Luzon Conference',
      'Cavite Mission',
      'Mindoro Island Mission',
      'Palawan Mission',
      'Southern Luzon Mission',
    ],
    churches: 819,
    membership: 124535,
    population: 22911571,
    memberToPopRatio: 184,
    avgMembersPerChurch: 152,
    streetAddress: 'Bugtong na Pulo, 4217 Lipa City, Batangas, Philippines',
    socialLinks: {},
    avgInternetPenetrationPct: 86.3,
    offlinePopulationSummary: '13.7% offline nationally (higher in rural Mindoro, Palawan & island municipalities)',
    isHighOfflineTerritory: false,
    isSensitiveTerritory: false,
    sensitivityLevel: 'Open',
    sensitivitySummary:
      'Open religious freedom (4/4). Spans industrial Calabarzon commuter cities (Cavite, Laguna, Batangas) and frontier island/indigenous territories in Mindoro (Mangyan) and southern Palawan (Molbog/Palawano).',
    topPlatformsSummary: COUNTRY_INTELLIGENCE.Philippines.topPlatforms,
    countryProfiles: [COUNTRY_INTELLIGENCE.Philippines],
    totalPeopleGroupsCount: 38,
    leastReachedGroupsCount: 4,
    livingLanguagesCount: 35,
    primaryLanguagesSummary: 'Tagalog, Bikol, Mangyan, Cuyonon, Palawano',
    keyPeopleGroups: [
      {
        name: 'Molbog & Palawano Indigenous Peoples (Southern Palawan)',
        country: 'Philippines',
        population: 145000,
        primaryReligion: 'Islam / Ethnic Religions',
        language: 'Molbog / Palawano',
        isFrontier: false,
        jpScale: 1,
        notes: 'Least-reached coastal and interior communities in Palawan Mission.',
      },
      {
        name: 'Mangyan Tribes (Alangan, Hanunoo, Buhid in Mindoro)',
        country: 'Philippines',
        population: 280000,
        primaryReligion: 'Ethnic Religions',
        language: 'Mangyan languages / Tagalog',
        isFrontier: false,
        jpScale: 2,
        notes: 'Interior mountain communities in Mindoro Island Mission; low internet connectivity.',
      },
    ],
  },

  'East Central Philippine Union Conference': {
    canonicalName: 'East Central Philippine Union Conference',
    acronym: 'ECPUC',
    category: 'Union Conference',
    formerName: 'Central Philippine Union Conference',
    organizedHistory: 'Organized 1964; reorganized 1996; reorganized, renamed, and territory divided 2026',
    countries: ['Philippines'],
    territoryDescription:
      'Central Visayas and Eastern Visayas Regions; and Masbate Province in Bicol Region.',
    constituentFields: [
      'Central Visayan Conference',
      'East Visayan Conference',
      'Negros Oriental-Siquijor Mission',
      'Samar Mission',
    ],
    churches: 705,
    membership: 119041,
    population: 13935826,
    memberToPopRatio: 117,
    avgMembersPerChurch: 169,
    streetAddress: '112 Gorordo Avenue, Kamputhaw, 6000 Cebu City, Philippines',
    mailingAddress: 'P.O. Box 3, 6000 Cebu City, Philippines',
    website: 'https://cpucsda.org',
    socialLinks: {
      facebook: ['https://www.facebook.com/CPUCph'],
      youtube: 'https://www.youtube.com/channel/UCdezbWZ3nSSOiHMN13uWF9Q',
    },
    avgInternetPenetrationPct: 86.3,
    offlinePopulationSummary: '13.7% offline nationally (higher in interior Samar & island barangays)',
    isHighOfflineTerritory: false,
    isSensitiveTerritory: false,
    sensitivityLevel: 'Open',
    sensitivitySummary:
      'Open religious freedom (4/4). Strong Cebuano and Waray cultural identity; Metro Cebu is a major university and BPO tech hub ideal for digital creator mobilization.',
    topPlatformsSummary: COUNTRY_INTELLIGENCE.Philippines.topPlatforms,
    countryProfiles: [COUNTRY_INTELLIGENCE.Philippines],
    totalPeopleGroupsCount: 18,
    leastReachedGroupsCount: 2,
    livingLanguagesCount: 16,
    primaryLanguagesSummary: 'Cebuano, Waray-Waray, Masbatenyo, Boholano, Bantayanon',
    keyPeopleGroups: [
      {
        name: 'Metro Cebu Urban Youth, University & BPO Workforce',
        country: 'Philippines',
        population: 3200000,
        primaryReligion: 'Christianity (Roman Catholic / Secularizing)',
        language: 'Cebuano / English',
        isFrontier: false,
        jpScale: 2,
        notes: 'High night-shift and digital engagement; strong potential for Cebuano short-form media & small groups.',
      },
      {
        name: 'Interior Samar & Island Waray Communities',
        country: 'Philippines',
        population: 1950000,
        primaryReligion: 'Christianity',
        language: 'Waray-Waray',
        isFrontier: false,
        jpScale: 2,
        notes: 'Samar Mission territory; benefits from Waray-language media and typhoon-resilient radio/community care.',
      },
    ],
  },

  'West Central Philippine Union Mission': {
    canonicalName: 'West Central Philippine Union Mission',
    acronym: 'WCPUM',
    category: 'Union Mission',
    formerName: 'Part of Central Philippine Union Conference',
    organizedHistory: 'Organized 2025',
    countries: ['Philippines'],
    territoryDescription: 'Western Visayas Region and Romblon Province in Mimaropa Region.',
    constituentFields: [
      'Negros Occidental Conference',
      'West Visayan Conference',
      'Northwestern Panay Mission',
      'Romblon Mission',
    ],
    churches: 727,
    membership: 114788,
    population: 7980660,
    memberToPopRatio: 70,
    avgMembersPerChurch: 158,
    streetAddress: 'Bongco, Pototan, Iloilo, Philippines',
    mailingAddress: 'Bongco, Pototan, Iloilo, Philippines',
    socialLinks: {},
    avgInternetPenetrationPct: 86.3,
    offlinePopulationSummary: '13.7% offline nationally',
    isHighOfflineTerritory: false,
    isSensitiveTerritory: false,
    sensitivityLevel: 'Open',
    sensitivitySummary:
      'Open religious freedom (4/4). Strong Adventist presence (1:70 member-to-population ratio) across Hiligaynon, Kinaray-a, Akeanon, and Romblomanon language communities.',
    topPlatformsSummary: COUNTRY_INTELLIGENCE.Philippines.topPlatforms,
    countryProfiles: [COUNTRY_INTELLIGENCE.Philippines],
    totalPeopleGroupsCount: 16,
    leastReachedGroupsCount: 2,
    livingLanguagesCount: 14,
    primaryLanguagesSummary: 'Hiligaynon, Kinaray-a, Akeanon, Capiznon, Romblomanon',
    keyPeopleGroups: [
      {
        name: 'Ati & Sulodnon (Panay Bukidnon) Indigenous Communities',
        country: 'Philippines',
        population: 110000,
        primaryReligion: 'Ethnic Religions / Folk Christianity',
        language: 'Inati / Ligbok / Hiligaynon',
        isFrontier: false,
        jpScale: 2,
        notes: 'Highland and island communities across Panay and Negros.',
      },
    ],
  },

  'Southwestern Philippine Union Conference': {
    canonicalName: 'Southwestern Philippine Union Conference',
    acronym: 'SWPUC',
    category: 'Union Conference',
    formerName: 'South Philippine Union Conference',
    organizedHistory: 'Organized 1951; reorganized 1990; reorganized and territory divided 2023; renamed 2024',
    countries: ['Philippines'],
    territoryDescription:
      'In Mindanao: Zamboanga Peninsula and Northern Mindanao Regions; and in Bangsamoro Autonomous Region in Muslim Mindanao (BARMM): Lanao del Sur province and the Sulu Archipelago.',
    constituentFields: [
      'North Central Mindanao Conference',
      'Western Mindanao Conference',
      'Central Mindanao Mission',
      'Northeastern Mindanao Mission',
      'Zamboanga Peninsula Mission',
    ],
    churches: 1470,
    membership: 352330,
    population: 12656423,
    memberToPopRatio: 36,
    avgMembersPerChurch: 240,
    streetAddress: 'Masterson Avenue, Upper Carmen, 9000 Cagayan de Oro City, Philippines',
    mailingAddress: 'P.O. Box 3, 9000 Cagayan de Oro City, Philippines',
    website: 'https://swpuc.adventist.ph',
    socialLinks: {
      facebook: ['https://www.facebook.com/spucadventist.org'],
      youtube: 'https://www.youtube.com/c/SouthPhilippineUnionConferenceofSDA',
      x: 'https://X.com/spucadventist',
    },
    avgInternetPenetrationPct: 86.3,
    offlinePopulationSummary: '13.7% offline nationally (higher in Sulu Archipelago & Lanao del Sur)',
    isHighOfflineTerritory: false,
    isSensitiveTerritory: true,
    sensitivityLevel: 'Moderated',
    sensitivitySummary:
      'High Adventist density in Northern Mindanao (1:36 overall ratio), but includes Lanao del Sur (Maranao) and the Sulu Archipelago (Tausug, Sama-Bajau) where Playbook Play 7 respectful contextualization and safe contact routing are essential.',
    topPlatformsSummary: COUNTRY_INTELLIGENCE.Philippines.topPlatforms,
    countryProfiles: [COUNTRY_INTELLIGENCE.Philippines],
    totalPeopleGroupsCount: 34,
    leastReachedGroupsCount: 9,
    livingLanguagesCount: 31,
    primaryLanguagesSummary: 'Cebuano, Chavacano, Maranao, Tausug, Subanen',
    keyPeopleGroups: [
      {
        name: 'Maranao (Lanao del Sur)',
        country: 'Philippines',
        population: 1460000,
        primaryReligion: 'Islam',
        language: 'Maranao',
        isFrontier: true,
        jpScale: 1,
        notes: 'Largest unreached people group in Lanao del Sur; requires friendship evangelism, health/education care, and Playbook Play 7 privacy.',
      },
      {
        name: 'Tausug & Sama-Bajau (Sulu Archipelago & Zamboanga)',
        country: 'Philippines',
        population: 1850000,
        primaryReligion: 'Islam',
        language: 'Tausug / Sinama / Chavacano',
        isFrontier: true,
        jpScale: 1,
        notes: 'Sulu, Basilan, Tawi-Tawi, and Zamboanga coast; high need for vernacular radio and community literacy/health.',
      },
      {
        name: 'Higaonon, Bukidnon & Subanen Lumad Communities',
        country: 'Philippines',
        population: 920000,
        primaryReligion: 'Ethnic Religions / Christianity',
        language: 'Binukid / Subanen / Cebuano',
        isFrontier: false,
        jpScale: 2,
        notes: 'Highland communities in Northern and Western Mindanao.',
      },
    ],
  },

  'Southeastern Philippine Union Mission': {
    canonicalName: 'Southeastern Philippine Union Mission',
    acronym: 'SePUM',
    category: 'Union Mission',
    formerName: 'Part of Southwestern (South) Philippine Union Conference',
    organizedHistory: 'Organized 2023; reorganized 2024',
    countries: ['Philippines'],
    territoryDescription:
      'In Mindanao: Caraga, Davao, and Soccsksargen regions; and in Bangsamoro Autonomous Region in Muslim Mindanao (BARMM, excluding Lanao del Sur province).',
    constituentFields: [
      'Davao Mission',
      'Northern Davao Mission',
      'South Central Mindanao Mission',
      'Southeastern Caraga Mission',
      'Southern Mindanao Mission',
    ],
    churches: 1130,
    membership: 468629,
    population: 14596325,
    memberToPopRatio: 31,
    avgMembersPerChurch: 415,
    streetAddress: 'Purok 3, Barangay Tacunan, Tugbok District, 8000 Davao City, Philippines',
    website: 'https://sepumadventist.org',
    socialLinks: {
      facebook: ['https://www.facebook.com/sepumadventist'],
      instagram: 'https://www.instagram.com/sepumadventist',
      youtube: 'https://www.youtube.com/@AdventistMediaSePUM',
      x: 'https://X.com/SePUMAdventist',
    },
    avgInternetPenetrationPct: 86.3,
    offlinePopulationSummary: '13.7% offline nationally (higher in Maguindanao & interior Lumad highlands)',
    isHighOfflineTerritory: false,
    isSensitiveTerritory: true,
    sensitivityLevel: 'Moderated',
    sensitivitySummary:
      'Highest Adventist membership density in SSD (468,629 members, 1:31 ratio), providing massive lay mobilization power (KPI 5), while bordering Maguindanao (BARMM) where Playbook Play 7 sensitivity is required.',
    topPlatformsSummary: COUNTRY_INTELLIGENCE.Philippines.topPlatforms,
    countryProfiles: [COUNTRY_INTELLIGENCE.Philippines],
    totalPeopleGroupsCount: 36,
    leastReachedGroupsCount: 7,
    livingLanguagesCount: 33,
    primaryLanguagesSummary: "Cebuano, Davawenyo, Maguindanaon, B'laan, Manobo",
    keyPeopleGroups: [
      {
        name: 'Maguindanao & Iranun (BARMM / Soccsksargen)',
        country: 'Philippines',
        population: 1950000,
        primaryReligion: 'Islam',
        language: 'Maguindanaon / Iranun',
        isFrontier: true,
        jpScale: 1,
        notes: 'Major unreached people groups in Cotabato/Maguindanao; requires culturally respectful peace-building and Playbook Play 7 care.',
      },
      {
        name: "B'laan, T'boli & Manobo Highland Communities",
        country: 'Philippines',
        population: 1150000,
        primaryReligion: 'Ethnic Religions / Christianity',
        language: "B'laan / T'boli / Manobo",
        isFrontier: false,
        jpScale: 2,
        notes: 'Highland communities across Davao, Sarangani, South Cotabato, and Agusan.',
      },
    ],
  },

  'Central Indonesia Union Mission': {
    canonicalName: 'Central Indonesia Union Mission',
    acronym: 'CIUM',
    category: 'Union Mission',
    formerName: 'West Indonesia Union Mission',
    organizedHistory: 'Organized 1929; reorganized 1964, 2024; reorganized, renamed, and territory divided 2026',
    countries: ['Indonesia'],
    territoryDescription:
      'Bali, Java (except for the western tip), Kalimantan, and Nusa Tenggara.',
    constituentFields: [
      'East Java Conference',
      'Jakarta Conference',
      'West Java Conference',
      'Central Java Mission',
      'East Kalimantan Mission',
      'Nusa Tenggara Mission',
      'West Kalimantan Region',
    ],
    churches: 475,
    membership: 59693,
    population: 163673737,
    memberToPopRatio: 2742,
    avgMembersPerChurch: 126,
    streetAddress:
      'Jl. MT. Haryono, Blok A, Kav 4-5, Rt. 001 Rw. 06, Kelurahan Tebet, Kecamatan Tebet, South Jakarta 12810, Indonesia',
    website: 'http://www.wium.org',
    socialLinks: {
      instagram: 'https://www.instagram.com/advent.indonesiabarat',
    },
    avgInternetPenetrationPct: 80.5,
    offlinePopulationSummary: '19.5% offline across Indonesia (55.82M unconnected citizens)',
    isHighOfflineTerritory: true,
    isSensitiveTerritory: true,
    sensitivityLevel: 'Sensitive (Play 7 Required)',
    sensitivitySummary:
      'Largest population in SSD (163.67M people, 1:2,742 ratio) covering Java, Bali, Kalimantan, and Nusa Tenggara. Indonesia has Religious Freedom 1/4 (Freedom House)—Group D/E media must use respectful family/health/hope entry points and private WhatsApp opt-in routing (Playbook Play 7).',
    topPlatformsSummary: COUNTRY_INTELLIGENCE.Indonesia.topPlatforms,
    countryProfiles: [COUNTRY_INTELLIGENCE.Indonesia],
    totalPeopleGroupsCount: 195,
    leastReachedGroupsCount: 78,
    livingLanguagesCount: 175,
    primaryLanguagesSummary: 'Indonesian, Javanese, Sundanese, Madurese, Balinese',
    keyPeopleGroups: [
      {
        name: 'Javanese (Central & East Java)',
        country: 'Indonesia',
        population: 102000000,
        primaryReligion: 'Islam',
        language: 'Javanese / Indonesian',
        isFrontier: false,
        jpScale: 1,
        notes: 'Largest people group in Southeast Asia; high digital connectivity in cities alongside rural heartland.',
      },
      {
        name: 'Sundanese (West Java)',
        country: 'Indonesia',
        population: 43000000,
        primaryReligion: 'Islam',
        language: 'Sundanese / Indonesian',
        isFrontier: true,
        jpScale: 1,
        notes: 'One of the largest Frontier People Groups globally; requires sensitive, relational holistic ministry (Play 7).',
      },
      {
        name: 'Madurese (East Java & Kalimantan)',
        country: 'Indonesia',
        population: 8200000,
        primaryReligion: 'Islam',
        language: 'Madurese',
        isFrontier: true,
        jpScale: 1,
        notes: 'Frontier people group in Madura Island and coastal East Java/Kalimantan.',
      },
      {
        name: 'Balinese (Bali & Lombok)',
        country: 'Indonesia',
        population: 4300000,
        primaryReligion: 'Hinduism',
        language: 'Balinese / Indonesian',
        isFrontier: false,
        jpScale: 1,
        notes: 'Majority Hindu culture in Nusa Tenggara Mission; community health and creative media bridges.',
      },
      {
        name: 'Banjar & Dayak Communities (Kalimantan)',
        country: 'Indonesia',
        population: 6800000,
        primaryReligion: 'Islam / Christianity / Ethnic',
        language: 'Banjar / Dayak languages',
        isFrontier: false,
        jpScale: 1,
        notes: 'Includes Indonesia’s new capital region (IKN Nusantara) in East Kalimantan.',
      },
    ],
  },

  'East Indonesia Union Conference': {
    canonicalName: 'East Indonesia Union Conference',
    acronym: 'EIUC',
    category: 'Union Conference',
    organizedHistory: 'Organized 1964; reorganized 1998, 2024',
    countries: ['Indonesia'],
    territoryDescription: 'Papua, Maluku, Sangihe, Talaud, and Sulawesi.',
    constituentFields: [
      'Manado and North Maluku Conference',
      'Minahasa Conference',
      'South Sulawesi Conference',
      'Bolaang Mongondow and Gorontalo Mission',
      'Central Sulawesi Mission',
      'Luwu Tana Toraja Mission',
      'Maluku Mission',
      'North Minahasa Bitung Mission',
      'Northern Island Mission',
      'Papua Mission',
      'Papua Barat Daya Mission',
      'Papua Tengah Mission',
      'West Papua Mission',
    ],
    churches: 1069,
    membership: 93440,
    population: 57609182,
    memberToPopRatio: 617,
    avgMembersPerChurch: 87,
    streetAddress: 'Jl. Sarapung No. 31, Manado 95111, North Sulawesi, Indonesia',
    mailingAddress: 'P.O. Box 1303, Manado 95013, North Sulawesi, Indonesia',
    website: 'https://www.sdaeiuc.org',
    socialLinks: {
      facebook: ['https://www.facebook.com/gmahkukikt'],
      instagram: 'https://www.instagram.com/advent.indonesiatimur',
      youtube: 'https://www.youtube.com/@ADVENTINDONESIATIMUR1964',
    },
    avgInternetPenetrationPct: 80.5,
    offlinePopulationSummary: '19.5% offline nationally (significantly higher in interior Papua & island Maluku)',
    isHighOfflineTerritory: true,
    isSensitiveTerritory: true,
    sensitivityLevel: 'Moderated',
    sensitivitySummary:
      'Strong Christian presence in Minahasa, Toraja, Maluku, and Papua (1,069 churches across 13 missions/conferences), alongside majority-Muslim provinces in South Sulawesi (Makassar/Bugis) and Gorontalo where Playbook Play 7 applies.',
    topPlatformsSummary: COUNTRY_INTELLIGENCE.Indonesia.topPlatforms,
    countryProfiles: [COUNTRY_INTELLIGENCE.Indonesia],
    totalPeopleGroupsCount: 412,
    leastReachedGroupsCount: 84,
    livingLanguagesCount: 385,
    primaryLanguagesSummary: 'Indonesian, Manado Malay, Makassar, Bugis, Papuan',
    keyPeopleGroups: [
      {
        name: 'Bugis & Makassarese (South Sulawesi)',
        country: 'Indonesia',
        population: 9800000,
        primaryReligion: 'Islam',
        language: 'Bugis / Makassar / Indonesian',
        isFrontier: true,
        jpScale: 1,
        notes: 'Major seafaring and commercial people groups in South Sulawesi; requires Playbook Play 7 sensitivity.',
      },
      {
        name: 'Gorontalo & Bolaang Mongondow Communities',
        country: 'Indonesia',
        population: 1650000,
        primaryReligion: 'Islam',
        language: 'Gorontalo / Mongondow / Indonesian',
        isFrontier: true,
        jpScale: 1,
        notes: 'Northern Sulawesi peninsula; responsive to health and family media.',
      },
      {
        name: 'Interior Papuan Highland & Coastal Tribes',
        country: 'Indonesia',
        population: 3400000,
        primaryReligion: 'Christianity / Ethnic Religions',
        language: 'Papuan languages / Indonesian',
        isFrontier: false,
        jpScale: 2,
        notes: '4 Missions across Papua; severe terrain & bandwidth limits make audio proclamation kits and aviation/community ministry crucial.',
      },
    ],
  },

  'West Indonesia Union Mission': {
    canonicalName: 'West Indonesia Union Mission',
    acronym: 'WIUM',
    category: 'Union Mission',
    formerName: 'Split from former West Indonesia Union Mission (2026 reorganization)',
    organizedHistory: 'Organized 2026',
    countries: ['Indonesia'],
    territoryDescription: 'Sumatra and the western tip of Java (Jakarta-Banten).',
    constituentFields: [
      'Jakarta-Banten Conference',
      'Central Sumatra Mission',
      'North Sumatra Mission',
      'South Sumatra Mission',
    ],
    churches: 475,
    membership: 37824,
    population: 69329726,
    memberToPopRatio: 1833,
    avgMembersPerChurch: 80,
    streetAddress: 'Pekanbaru, Central Sumatra, Indonesia',
    socialLinks: {},
    avgInternetPenetrationPct: 80.5,
    offlinePopulationSummary: '19.5% offline across Indonesia',
    isHighOfflineTerritory: false,
    isSensitiveTerritory: true,
    sensitivityLevel: 'Sensitive (Play 7 Required)',
    sensitivitySummary:
      'Covers 69.33M people across Sumatra and Banten (1:1,833 ratio). Includes strong Batak Christian communities in North Sumatra alongside strict Sharia/conservative regions in Aceh, West Sumatra (Minangkabau), and Banten—Playbook Play 7 safe routing is essential.',
    topPlatformsSummary: COUNTRY_INTELLIGENCE.Indonesia.topPlatforms,
    countryProfiles: [COUNTRY_INTELLIGENCE.Indonesia],
    totalPeopleGroupsCount: 178,
    leastReachedGroupsCount: 82,
    livingLanguagesCount: 150,
    primaryLanguagesSummary: 'Indonesian, Batak, Minangkabau, Acehnese, Musi',
    keyPeopleGroups: [
      {
        name: 'Minangkabau (West Sumatra & Pekanbaru)',
        country: 'Indonesia',
        population: 7200000,
        primaryReligion: 'Islam',
        language: 'Minangkabau / Indonesian',
        isFrontier: true,
        jpScale: 1,
        notes: 'Matrilineal Muslim culture right in Central Sumatra Mission territory; requires Playbook Play 7 private dialogue.',
      },
      {
        name: 'Acehnese & Gayo (Aceh / Northern Sumatra)',
        country: 'Indonesia',
        population: 4400000,
        primaryReligion: 'Islam',
        language: 'Acehnese / Indonesian',
        isFrontier: true,
        jpScale: 1,
        notes: 'Special autonomous Sharia province; outreach must focus on compassionate health, disaster resilience, and private opt-in care.',
      },
      {
        name: 'Bantenese & Palembang Malay (Banten & South Sumatra)',
        country: 'Indonesia',
        population: 9100000,
        primaryReligion: 'Islam',
        language: 'Bantenese / Musi / Indonesian',
        isFrontier: true,
        jpScale: 1,
        notes: 'High population density in Jakarta-Banten and South Sumatra corridors.',
      },
    ],
  },

  'Malaysia Union Mission': {
    canonicalName: 'Malaysia Union Mission',
    acronym: 'MAUM',
    category: 'Union Mission',
    formerName: 'Part of Southeastern (Southeast) Asia Union Mission',
    organizedHistory: 'Organized 2022; reorganized 2025',
    countries: ['Malaysia', 'Brunei'],
    territoryDescription: 'Brunei Darussalam and Malaysia.',
    constituentFields: [
      'Northern Sabah Mission',
      'Peninsular Malaysia Mission',
      'Sabah Mission',
      'Sarawak Mission',
    ],
    churches: 485,
    membership: 60463,
    population: 34658000,
    memberToPopRatio: 573,
    avgMembersPerChurch: 125,
    streetAddress:
      'D20, Persiaran Utama S2-1, Seremban 2, 70300 Seremban, Negeri Sembilan Darul Khusus, Malaysia',
    website: 'https://adventist.my',
    socialLinks: {
      facebook: ['https://www.facebook.com/MalaysiaUnionMission'],
      instagram: 'https://www.instagram.com/adventistmy',
      youtube: 'https://www.youtube.com/@malaysiaunionmission',
    },
    avgInternetPenetrationPct: 98.2,
    offlinePopulationSummary: 'Only 1.8% offline (98.2% internet penetration, 141.8 Mbps mobile speed)',
    isHighOfflineTerritory: false,
    isSensitiveTerritory: true,
    sensitivityLevel: 'Sensitive (Play 7 Required)',
    sensitivitySummary:
      'Strong church base in Sabah and Sarawak alongside Peninsular Malaysia & Brunei. Both Malaysia and Brunei have Religious Freedom 1/4 with strict laws prohibiting proselytization of Muslims—proposals targeting Group D/E must follow Playbook Play 7 safe routing.',
    topPlatformsSummary: COUNTRY_INTELLIGENCE.Malaysia.topPlatforms,
    countryProfiles: [COUNTRY_INTELLIGENCE.Malaysia, COUNTRY_INTELLIGENCE.Brunei],
    totalPeopleGroupsCount: 224,
    leastReachedGroupsCount: 97,
    livingLanguagesCount: 138,
    primaryLanguagesSummary: 'Malay, Mandarin/Hokkien/Hakka, Tamil, Iban, Dusun',
    // Exact data from uploaded Joshua Project Malaysia CSV (People_Group_In_Countries__8-13-26__ed5536fb)
    keyPeopleGroups: [
      {
        name: 'Malay (Peninsular Malaysia, Sabah, Sarawak & Brunei)',
        country: 'Malaysia',
        population: 14353000,
        primaryReligion: 'Islam',
        language: 'Malay',
        isFrontier: true,
        jpScale: 1,
        notes: 'Joshua Project: 14.35M pop, Frontier People Group (Scale 1). Requires Playbook Play 7 respectful cultural bridges.',
      },
      {
        name: 'Chinese Dialect Groups (Hokkien 2.02M, Hakka 1.79M, Cantonese 1.44M, Mandarin 1.02M, Teochew 1.04M)',
        country: 'Malaysia',
        population: 7316000,
        primaryReligion: 'Buddhism / Chinese Folk Religion',
        language: 'Hokkien / Hakka / Cantonese / Mandarin',
        isFrontier: false,
        jpScale: 2,
        notes: 'Joshua Project: Over 7.3M across urban Peninsular Malaysia, Sabah & Sarawak; open to Chinese/English digital media, health, and family seminars.',
      },
      {
        name: 'Tamil & Telugu Indian Communities',
        country: 'Malaysia',
        population: 2158000,
        primaryReligion: 'Hinduism',
        language: 'Tamil / Telugu / English',
        isFrontier: false,
        jpScale: 2,
        notes: 'Joshua Project: 2.095M Tamil + 63K Telugu in Peninsular Malaysia; responsive to community care and youth/family media.',
      },
      {
        name: 'West Coast Bajau & Sulu Tausug (Sabah)',
        country: 'Malaysia',
        population: 519000,
        primaryReligion: 'Islam',
        language: 'Bajau / Tausug / Malay',
        isFrontier: true,
        jpScale: 1,
        notes: 'Joshua Project: 273K West Coast Bajau + 246K Sulu Tausug in Sabah; least-reached coastal communities.',
      },
      {
        name: 'Iban (807K) & Kadazan-Dusun (Sabah & Sarawak)',
        country: 'Malaysia',
        population: 1350000,
        primaryReligion: 'Christianity / Ethnic Religions',
        language: 'Iban / Central Dusun / Malay',
        isFrontier: false,
        jpScale: 4,
        notes: 'Core indigenous heartland of Sarawak and Sabah Missions; key base for equipping youth creators (KPI 5).',
      },
    ],
  },

  'Myanmar Union Mission': {
    canonicalName: 'Myanmar Union Mission',
    acronym: 'MYUM',
    category: 'Union Mission',
    organizedHistory: 'Organized 1919; reorganized 1938',
    countries: ['Myanmar'],
    territoryDescription: 'Myanmar.',
    constituentFields: [
      'Ayeyarwady Mission',
      'Central Myanmar Mission',
      'South East Mission',
      'Upper Myanmar Mission',
      'Yangon Mission',
    ],
    churches: 250,
    membership: 41043,
    population: 57527000,
    memberToPopRatio: 1402,
    avgMembersPerChurch: 164,
    streetAddress: '68 U Wisara Road, Dagon 11191, Yangon, Myanmar',
    mailingAddress: 'P.O. Box 977, Yangon, Myanmar',
    website: 'http://www.adventistmyanmar.org',
    socialLinks: {},
    avgInternetPenetrationPct: 72.5,
    offlinePopulationSummary: '27.5% offline (15.1M unconnected; 65.4% rural population)',
    isHighOfflineTerritory: true,
    isSensitiveTerritory: true,
    sensitivityLevel: 'Sensitive (Play 7 Required)',
    sensitivitySummary:
      'Ongoing civil conflict, VPN restrictions, and blocks on Meta platforms have cut Facebook reach to 13.7M while TikTok has surged to 21.0M (53.4% of adults). High offline population (15.1M) makes SD-card/offline proclamation kits, community care, and Playbook Play 7 safety vital.',
    topPlatformsSummary: COUNTRY_INTELLIGENCE.Myanmar.topPlatforms,
    countryProfiles: [COUNTRY_INTELLIGENCE.Myanmar],
    totalPeopleGroupsCount: 139,
    leastReachedGroupsCount: 54,
    livingLanguagesCount: 120,
    primaryLanguagesSummary: 'Burmese, Shan, Karen, Chin, Kachin',
    keyPeopleGroups: [
      {
        name: 'Bamar / Burmese Majority',
        country: 'Myanmar',
        population: 34500000,
        primaryReligion: 'Buddhism',
        language: 'Burmese',
        isFrontier: false,
        jpScale: 1,
        notes: 'Theravada Buddhist majority across Central Myanmar and Yangon; high need for hope, trauma care, and Burmese media.',
      },
      {
        name: 'Shan, Rakhine & Mon Communities',
        country: 'Myanmar',
        population: 9200000,
        primaryReligion: 'Buddhism',
        language: 'Shan / Rakhine / Mon / Burmese',
        isFrontier: false,
        jpScale: 1,
        notes: 'Least-reached Buddhist ethnic states.',
      },
      {
        name: 'Chin, Karen & Kachin Communities',
        country: 'Myanmar',
        population: 5800000,
        primaryReligion: 'Christianity / Buddhism / Ethnic',
        language: 'Chin / Karen / Jingpho / Burmese',
        isFrontier: false,
        jpScale: 4,
        notes: 'Primary membership base of MYUM; key for mobilizing youth digital missionaries and humanitarian care teams.',
      },
    ],
  },

  'Southeastern Asia Union Mission': {
    canonicalName: 'Southeastern Asia Union Mission',
    acronym: 'SEUM',
    category: 'Union Mission',
    formerName: 'Southeast Asia Union Mission',
    organizedHistory:
      'Organized 1917; reorganized 1929, 2019; reorganized, divided, renamed, and relocated 2022; reorganized 2026',
    countries: ['Thailand', 'Vietnam', 'Cambodia', 'Laos'],
    territoryDescription:
      "Cambodia, Lao People's Democratic Republic, Thailand, and Vietnam.",
    constituentFields: [
      'Cambodia Mission',
      'Laos Mission',
      'Thailand Mission',
      'Vietnam Mission',
      'Northeastern Thailand Region',
      'Western Thailand Region',
    ],
    churches: 143,
    membership: 44237,
    population: 197092000,
    memberToPopRatio: 4455,
    avgMembersPerChurch: 309,
    streetAddress: '193 Moo 3, Muaklek, Saraburi 18180, Thailand',
    website: 'http://www.seumsda.org',
    socialLinks: {
      facebook: ['http://www.facebook.com/SEUMSDA'],
    },
    avgInternetPenetrationPct: 85.4,
    offlinePopulationSummary:
      '28.3M offline across the 4 nations (Laos 36.4% offline, Cambodia 32.7% offline, Vietnam 15.4% offline, Thailand 5.4% offline)',
    isHighOfflineTerritory: true,
    isSensitiveTerritory: true,
    sensitivityLevel: 'Sensitive (Play 7 Required)',
    sensitivitySummary:
      'Highest frontier need in SSD: 197.09M people across 4 Buddhist/Secular nations with only 143 churches (1:4,455 ratio). Vietnam and Laos have Religious Freedom 1/4 and Not Free ratings (Playbook Play 7 mandatory). Local chat apps—Zalo (78.3M in Vietnam) and LINE (56.0M in Thailand)—are critical for KPI 2 & KPI 3 handoffs.',
    topPlatformsSummary: [
      { platform: 'Facebook', reach: '149.1M combined', notes: 'VN 79M, TH 51.5M, KH 14M, LA 4.6M' },
      { platform: 'TikTok', reach: '144.0M+ combined', notes: 'VN 76.1M, TH 56.6M, KH 11.3M' },
      { platform: 'Zalo (Vietnam)', reach: '78.3M in Vietnam', notes: '91% of Vietnamese internet users' },
      { platform: 'LINE (Thailand)', reach: '56.0M in Thailand', notes: '82.7% of Thai internet users' },
      { platform: 'YouTube', reach: '111.8M+ (VN & TH)', notes: 'VN 62.1M, TH 49.7M' },
    ],
    countryProfiles: [
      COUNTRY_INTELLIGENCE.Vietnam,
      COUNTRY_INTELLIGENCE.Thailand,
      COUNTRY_INTELLIGENCE.Cambodia,
      COUNTRY_INTELLIGENCE.Laos,
    ],
    totalPeopleGroupsCount: 486,
    leastReachedGroupsCount: 374,
    livingLanguagesCount: 295,
    primaryLanguagesSummary: 'Vietnamese, Thai, Khmer, Lao, Hmong',
    keyPeopleGroups: [
      {
        name: 'Kinh / Vietnamese Majority',
        country: 'Vietnam',
        population: 86500000,
        primaryReligion: 'Non-Religious / Folk Buddhism',
        language: 'Vietnamese',
        isFrontier: false,
        jpScale: 1,
        notes: '79M on Facebook, 78.3M on Zalo, 76.1M on TikTok; requires Playbook Play 7 safe Zalo/Messenger care.',
      },
      {
        name: 'Central & Northeastern (Isan) Thai',
        country: 'Thailand',
        population: 58000000,
        primaryReligion: 'Buddhism',
        language: 'Thai / Isan',
        isFrontier: false,
        jpScale: 1,
        notes: '56.6M on TikTok and 56.0M on LINE; Northeastern Thailand Region is a major frontier focus.',
      },
      {
        name: 'Khmer Majority',
        country: 'Cambodia',
        population: 15800000,
        primaryReligion: 'Buddhism',
        language: 'Khmer',
        isFrontier: false,
        jpScale: 1,
        notes: 'Median age 26.4; 73.3% rural and 32.7% offline—requires hybrid Facebook/TikTok + community/radio outreach.',
      },
      {
        name: 'Lao Majority & Highland Ethnic Groups',
        country: 'Laos',
        population: 7900000,
        primaryReligion: 'Buddhism / Ethnic Religions',
        language: 'Lao / Hmong / Khmu',
        isFrontier: false,
        jpScale: 1,
        notes: 'Median age 25.2; 36.4% offline; Religious Freedom 1/4—requires Playbook Play 7 safe handoffs.',
      },
    ],
  },

  'Singapore Conference': {
    canonicalName: 'Singapore Conference',
    acronym: 'SAC',
    category: 'Attached Field',
    formerName: 'Part of Southeastern (Southeast) Asia Union Mission',
    organizedHistory: 'Organized 1915; reorganized 1988, 2022',
    countries: ['Singapore'],
    territoryDescription: 'Republic of Singapore.',
    constituentFields: ['Singapore Conference (8 Churches)'],
    churches: 8,
    membership: 3430,
    population: 6213000,
    memberToPopRatio: 1811,
    avgMembersPerChurch: 429,
    streetAddress: '798 Thomson Road, Singapore 298186, Republic of Singapore',
    website: 'http://www.adventist.org.sg',
    socialLinks: {
      facebook: ['https://www.facebook.com/SingaporeAdventist'],
      instagram: 'https://www.instagram.com/singaporeadventist',
    },
    avgInternetPenetrationPct: 96.0,
    offlinePopulationSummary: 'Only 4.0% offline (100% urban city-state)',
    isHighOfflineTerritory: false,
    isSensitiveTerritory: false,
    sensitivityLevel: 'Moderated',
    sensitivitySummary:
      'High-income, 100% urban global hub (6.21M population, 8 churches, 3,430 members, 1:1,811 ratio). Regulated under Maintenance of Religious Harmony framework (Religious Freedom 3/4)—wellness, mental health, family, and professional life-coaching bridges excel here.',
    topPlatformsSummary: COUNTRY_INTELLIGENCE.Singapore.topPlatforms,
    countryProfiles: [COUNTRY_INTELLIGENCE.Singapore],
    totalPeopleGroupsCount: 60,
    leastReachedGroupsCount: 24,
    livingLanguagesCount: 24,
    primaryLanguagesSummary: 'English, Mandarin, Malay, Tamil, Hokkien',
    keyPeopleGroups: [
      {
        name: 'Secular & Buddhist/Taoist Urban Chinese (Mandarin / English)',
        country: 'Singapore',
        population: 4400000,
        primaryReligion: 'Buddhism / Non-Religious / Taoism',
        language: 'English / Mandarin',
        isFrontier: false,
        jpScale: 2,
        notes: 'High stress, aging median age (43.2); responsive to mental resilience, longevity, and digital community.',
      },
      {
        name: 'Malay & South Asian Diaspora Communities',
        country: 'Singapore',
        population: 1450000,
        primaryReligion: 'Islam / Hinduism',
        language: 'English / Malay / Tamil',
        isFrontier: false,
        jpScale: 1,
        notes: 'Requires respectful interfaith sensitivity under Singapore’s religious harmony norms.',
      },
    ],
  },

  'Timor-Leste Mission': {
    canonicalName: 'Timor-Leste Mission',
    acronym: 'TLM',
    category: 'Attached Field',
    organizedHistory: 'Organized 2009',
    countries: ['Timor-Leste'],
    territoryDescription: 'Timor-Leste.',
    constituentFields: ['Timor-Leste Mission (4 Churches)'],
    churches: 4,
    membership: 727,
    population: 1413000,
    memberToPopRatio: 1944,
    avgMembersPerChurch: 182,
    streetAddress: 'Do Fomento, Fomento 1, Comoro, Dili, Timor-Leste',
    mailingAddress: 'P.O. Box 63, Dili, Timor-Leste',
    socialLinks: {},
    avgInternetPenetrationPct: 40.4,
    offlinePopulationSummary: '59.6% offline (851K unconnected; 64.5% rural; 4.93 Mbps mobile speed)',
    isHighOfflineTerritory: true,
    isSensitiveTerritory: false,
    sensitivityLevel: 'Open',
    sensitivitySummary:
      'Youngest population in SSD (median age 21.4) with only 4 churches and 727 members for 1.41M people (1:1,944 ratio). Because 59.6% of the country is offline and mobile speeds average 4.93 Mbps, radio/audio proclamation kits, Tetum literature, and community health/literacy are critical alongside Facebook (687K reach).',
    topPlatformsSummary: COUNTRY_INTELLIGENCE['Timor-Leste'].topPlatforms,
    countryProfiles: [COUNTRY_INTELLIGENCE['Timor-Leste']],
    totalPeopleGroupsCount: 36,
    leastReachedGroupsCount: 3,
    livingLanguagesCount: 20,
    primaryLanguagesSummary: 'Tetum, Portuguese, Mambae, Makasae, Indonesian',
    keyPeopleGroups: [
      {
        name: 'Tetum, Mambae & Makasae Youth & Rural Communities',
        country: 'Timor-Leste',
        population: 1380000,
        primaryReligion: 'Christianity (Roman Catholic) / Ethnic',
        language: 'Tetum / Portuguese / Indonesian',
        isFrontier: false,
        jpScale: 2,
        notes: 'Median age 21.4; 59.6% offline—high impact from Tetum audio/radio, ADRA/health clinics, and youth education.',
      },
    ],
  },
};

export const SSD_DIVISION_YEARBOOK_TOTALS = {
  unionsAndFieldsCount: 14,
  constituentFieldsCount: 69,
  countriesCount: 11,
  churches: 8687,
  membership: 1642387,
  avgMembersPerChurch: 189,
  population: 701885646,
  memberToPopRatio: 427,
  totalPeopleGroupsCount: 1940,
  leastReachedGroupsCount: 826,
  livingLanguagesCount: 1320,
  primaryLanguagesSummary: 'Indonesian, Tagalog, Vietnamese, Thai, Burmese',
};

/**
 * Returns the canonical UnionIntelligenceProfile for any union name or acronym.
 */
export function getUnionIntelligence(unionInput?: string): UnionIntelligenceProfile | null {
  if (!unionInput) return null;
  const canonical = getCanonicalUnion(unionInput);
  if (UNION_INTELLIGENCE_PROFILES[canonical]) {
    return UNION_INTELLIGENCE_PROFILES[canonical];
  }
  // Fallback search by acronym
  const upper = unionInput.trim().toUpperCase();
  for (const profile of Object.values(UNION_INTELLIGENCE_PROFILES)) {
    if (profile.acronym.toUpperCase() === upper) {
      return profile;
    }
  }
  return null;
}

export interface KpiTerritoryBenchmark {
  hasTarget: boolean;
  targetValue: number;
  ratioLabel: string;
  benchmarkSummary: string;
  status: 'realistic' | 'ambitious' | 'exceeds_capacity';
  warningTitle?: string;
  warningMessage?: string;
  suggestedTarget?: string;
}

export interface ProposalUnionIntelEvaluation {
  profile: UnionIntelligenceProfile;
  kpiBenchmark: KpiTerritoryBenchmark | null;
  needsPlay7SafeRouting: boolean;
  play7Title: string;
  play7Message: string;
  play7Snippet: string;
  missingLocalPlatformOpportunity: {
    platformName: string;
    reachLabel: string;
    countryName: string;
    suggestionMessage: string;
    snippet: string;
  } | null;
  highOfflineAdvisory: {
    offlineSummary: string;
    message: string;
  } | null;
}

/**
 * Evaluates a Proposal against its Union's Yearbook & Digital/Freedom Intelligence.
 */
export function evaluateProposalUnionIntelligence(
  proposal: Proposal
): ProposalUnionIntelEvaluation | null {
  const profile = getUnionIntelligence(proposal.union);
  if (!profile) return null;

  const canonicalKpi = getCanonicalKpiType(proposal.kpiType);
  const parsedKpi = parseKpiTargetNumber(
    proposal.kpiNumber,
    proposal.kpiDescription,
    proposal.kpiType
  );

  const combinedText = [
    proposal.title,
    proposal.overview,
    proposal.goal,
    proposal.outcomes,
    proposal.deliverables,
    proposal.pointsOfIntegration,
    proposal.audienceEDetails,
    proposal.kpiDescription,
    proposal.kpiRationale,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // 1. KPI Capacity & Plausibility Benchmark against Union Yearbook Stats
  let kpiBenchmark: KpiTerritoryBenchmark | null = null;
  if (canonicalKpi && parsedKpi.value && parsedKpi.value > 0) {
    const val = parsedKpi.value;

    if (canonicalKpi === 'implementation_capability') {
      // KPI 5: Mobilization & Capability Building -> Compare against Union Membership & Churches
      const pctOfMembers = (val / profile.membership) * 100;
      const perChurch = val / profile.churches;

      if (val > profile.membership) {
        const realisticFivePct = Math.max(50, Math.round((profile.membership * 0.05) / 10) * 10);
        kpiBenchmark = {
          hasTarget: true,
          targetValue: val,
          ratioLabel: `${pctOfMembers.toFixed(0)}% of Union Membership (${profile.membership.toLocaleString()} members)`,
          benchmarkSummary: `Target of ${val.toLocaleString()} exceeds ${profile.acronym}'s total church membership of ${profile.membership.toLocaleString()} across ${profile.churches.toLocaleString()} churches.`,
          status: 'exceeds_capacity',
          warningTitle: `KPI 5 Target Exceeds Total ${profile.acronym} Membership (${profile.membership.toLocaleString()})`,
          warningMessage: `You entered a Mobilization target of ${val.toLocaleString()} equipped members/creators, but ${profile.canonicalName} has ${profile.membership.toLocaleString()} total baptized members across ${profile.churches.toLocaleString()} churches (Adventist Yearbook). If you are counting video views or public reach, switch to KPI 1 (Reach); otherwise adjust your mobilization target to a realistic number of trained members (e.g., ${realisticFivePct.toLocaleString()}).`,
          suggestedTarget: realisticFivePct.toLocaleString(),
        };
      } else if (pctOfMembers > 35) {
        kpiBenchmark = {
          hasTarget: true,
          targetValue: val,
          ratioLabel: `${pctOfMembers.toFixed(1)}% of ${profile.acronym} Membership (~${perChurch.toFixed(1)} per church)`,
          benchmarkSummary: `Mobilizing ${val.toLocaleString()} members represents ${pctOfMembers.toFixed(1)}% of all ${profile.membership.toLocaleString()} members in ${profile.acronym} (~${perChurch.toFixed(1)} trained per church across ${profile.churches.toLocaleString()} churches).`,
          status: 'ambitious',
        };
      } else {
        kpiBenchmark = {
          hasTarget: true,
          targetValue: val,
          ratioLabel: `${pctOfMembers < 0.1 ? '<0.1' : pctOfMembers.toFixed(1)}% of ${profile.acronym} Membership (~${perChurch < 1 ? perChurch.toFixed(1) : Math.round(perChurch)} per church)`,
          benchmarkSummary: `Equips ${val.toLocaleString()} of ${profile.acronym}'s ${profile.membership.toLocaleString()} members (${pctOfMembers < 0.1 ? '<0.1' : pctOfMembers.toFixed(1)}% mobilization rate across ${profile.churches.toLocaleString()} churches).`,
          status: 'realistic',
        };
      }
    } else if (canonicalKpi === 'connection_next_steps') {
      // KPI 3: Connection & Bridging Handoff -> Compare against Local Churches
      const seekersPerChurch = val / profile.churches;
      kpiBenchmark = {
        hasTarget: true,
        targetValue: val,
        ratioLabel: `~${seekersPerChurch < 10 ? seekersPerChurch.toFixed(1) : Math.round(seekersPerChurch).toLocaleString()} bridged seekers per local church (${profile.churches.toLocaleString()} churches)`,
        benchmarkSummary: `Bridging ${val.toLocaleString()} seekers across ${profile.acronym}'s ${profile.churches.toLocaleString()} churches averages ~${seekersPerChurch < 10 ? seekersPerChurch.toFixed(1) : Math.round(seekersPerChurch).toLocaleString()} seekers per church.`,
        status: seekersPerChurch > 200 ? 'ambitious' : 'realistic',
      };
    } else if (canonicalKpi === 'retention_nurturing') {
      // KPI 4: Discipleship & Retention -> Compare against Local Churches
      const disciplesPerChurch = val / profile.churches;
      kpiBenchmark = {
        hasTarget: true,
        targetValue: val,
        ratioLabel: `~${disciplesPerChurch < 10 ? disciplesPerChurch.toFixed(1) : Math.round(disciplesPerChurch).toLocaleString()} nurtured per church (${profile.churches.toLocaleString()} churches)`,
        benchmarkSummary: `Nurturing ${val.toLocaleString()} people across ${profile.acronym}'s ${profile.churches.toLocaleString()} churches averages ~${disciplesPerChurch < 10 ? disciplesPerChurch.toFixed(1) : Math.round(disciplesPerChurch).toLocaleString()} per local church.`,
        status: disciplesPerChurch > 100 ? 'ambitious' : 'realistic',
      };
    } else if (canonicalKpi === 'reach_exposure') {
      // KPI 1: Reach & Exposure -> Compare against Territory Population / Online Population
      const onlinePop = Math.round(
        profile.population * (profile.avgInternetPenetrationPct / 100)
      );
      const pctOfOnline = onlinePop > 0 ? (val / onlinePop) * 100 : 0;
      kpiBenchmark = {
        hasTarget: true,
        targetValue: val,
        ratioLabel: `${pctOfOnline < 0.1 ? '<0.1' : pctOfOnline.toFixed(1)}% of ${profile.acronym}'s ~${(onlinePop / 1_000_000).toFixed(1)}M online population`,
        benchmarkSummary: `Reaching ${val.toLocaleString()} people in a territory of ${(profile.population / 1_000_000).toFixed(1)}M (${profile.avgInternetPenetrationPct}% internet penetration; 1 Adventist per ${profile.memberToPopRatio.toLocaleString()} people).`,
        status: val > profile.population * 2 ? 'ambitious' : 'realistic',
      };
    } else if (canonicalKpi === 'engagement_participation') {
      // KPI 2: Engagement & Digital Connection
      const perChurch = val / profile.churches;
      kpiBenchmark = {
        hasTarget: true,
        targetValue: val,
        ratioLabel: `~${perChurch < 10 ? perChurch.toFixed(1) : Math.round(perChurch).toLocaleString()} active conversations per church (${profile.churches.toLocaleString()} churches)`,
        benchmarkSummary: `${val.toLocaleString()} interactive conversations across ${profile.acronym} (${profile.membership.toLocaleString()} members available for Digital Missionary response).`,
        status: 'realistic',
      };
    }
  }

  // 2. Playbook Play 7 (Sensitive Context & Religious Freedom 1/4) Guardrail
  const audiences = proposal.targetAudiences || [];
  const targetsExternalNonAdventist =
    audiences.includes('D') ||
    audiences.includes('E') ||
    audiences.includes('group_e') ||
    proposal.divisionProject === 'Mission Intelligence: Reaching Unreached People Groups';

  const hasSafeRoutingKeywords =
    /\b(safe|privacy|private|consented|opt-in|opt\s+in|vetted|sensitive|play\s+7|whatsapp|zalo|line\b|encrypted|discreet|contextualiz|friendship|bridge)\b/i.test(
      `${proposal.audienceEDetails || ''} ${proposal.pointsOfIntegration || ''} ${proposal.outcomes || ''}`
    );

  const hasSubstantiveContent =
    (proposal.overview || '').trim().length > 20 ||
    (proposal.outcomes || '').trim().length > 20 ||
    audiences.length > 0;

  const needsPlay7SafeRouting = Boolean(
    profile.isSensitiveTerritory &&
      hasSubstantiveContent &&
      targetsExternalNonAdventist &&
      !hasSafeRoutingKeywords
  );

  // 3. Local Messaging Platform Opportunity (e.g. Zalo in Vietnam, LINE in Thailand, WhatsApp in Indonesia/Malaysia)
  let missingLocalPlatformOpportunity: ProposalUnionIntelEvaluation['missingLocalPlatformOpportunity'] =
    null;

  if (profile.acronym === 'SEUM' && (proposal.overview || '').trim().length > 25) {
    const mentionsVietnam = /\b(vietnam|vietnamese|hanoi|ho\s+chi\s+minh|saigon)\b/i.test(
      combinedText
    );
    const mentionsThailand = /\b(thailand|thai|bangkok|isan|chiang\s+mai)\b/i.test(combinedText);

    if (mentionsVietnam && !/\bzalo\b/i.test(combinedText)) {
      missingLocalPlatformOpportunity = {
        platformName: 'Zalo',
        reachLabel: '78.3M users (91% of internet users in Vietnam)',
        countryName: 'Vietnam',
        suggestionMessage:
          'Digital 2026 Intelligence shows Zalo reaches 78.3M people (91% of internet users) in Vietnam—almost equal to Facebook (79.0M) and far ahead of Messenger (57.8M). Consider including Zalo for private 1-on-1 seeker follow-up.',
        snippet:
          'Zalo & Facebook Messenger Response Routing (78.3M Zalo reach in Vietnam): Digital Missionaries facilitate private, consented 1-on-1 Bible & wellness conversations via Zalo before warm handoffs to local fellowships.',
      };
    } else if (mentionsThailand && !/\bline\b/i.test(combinedText)) {
      missingLocalPlatformOpportunity = {
        platformName: 'LINE & TikTok',
        reachLabel: '56.0M LINE users & 56.6M TikTok users in Thailand',
        countryName: 'Thailand',
        suggestionMessage:
          'Digital 2026 Intelligence shows TikTok (56.6M, 94.3% of adults) and LINE (56.0M, 82.7% of internet users) surpass Facebook (51.5M) in Thailand. Consider pairing short-form TikTok/Facebook discovery with LINE Official Account follow-up.',
        snippet:
          'LINE Official Account & TikTok Pathway (56.0M LINE reach in Thailand): Viewers from short-form video connect via LINE Official Account for automated study guides and 1-on-1 Digital Missionary care.',
      };
    }
  }

  // 4. High Offline Territory Context (TLM 59.6% offline, Laos 36.4%, Cambodia 32.7%, Myanmar 27.5%, Indonesia 55.8M offline)
  let highOfflineAdvisory: ProposalUnionIntelEvaluation['highOfflineAdvisory'] = null;
  if (profile.isHighOfflineTerritory) {
    highOfflineAdvisory = {
      offlineSummary: profile.offlinePopulationSummary,
      message:
        profile.acronym === 'TLM'
          ? '59.6% of Timor-Leste (851K people) is offline and median mobile speed is 4.93 Mbps. Pairing Facebook (687K reach) with Tetum radio/audio proclamation kits and community outreach maximizes field impact.'
          : profile.acronym === 'MYUM'
          ? '27.5% of Myanmar (15.1M people) is offline and VPN blocks restrict Facebook (13.7M) while TikTok reaches 21.0M. Combining TikTok/low-bandwidth digital assets with offline SD-card/proclamation kits strengthens resiliency.'
          : `${profile.offlinePopulationSummary}. Hybrid digital + local community/audio touchpoints help bridge both connected urban hubs and rural populations.`,
    };
  }

  return {
    profile,
    kpiBenchmark,
    needsPlay7SafeRouting,
    play7Title: `Territory Intelligence (${profile.acronym}): Sensitive Religious/Digital Context (Playbook Play 7)`,
    play7Message: `${profile.sensitivitySummary} Document how seeker contacts will be handled privately with explicit consent (Playbook pp. 8 & 38).`,
    play7Snippet: `Playbook Play 7 Safe Contact Routing (${profile.acronym}): Using culturally respectful felt-need entry points (health, family resilience, peace) and private, consented 1-on-1 messaging handoffs to vetted local Hope Care Teams.`,
    missingLocalPlatformOpportunity,
    highOfflineAdvisory,
  };
}
