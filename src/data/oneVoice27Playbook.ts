import { KPIType } from '../types';

export interface PlaybookPathwayStage {
  kpiId: KPIType;
  stageNumber: number;
  stageName: 'Reach' | 'Engage' | 'Connect' | 'Disciple' | 'Multiply';
  pageRef: string;
  purpose: string;
  whatHappens: string;
  whoLeads: string;
  whoSupports: string;
  whatGetsPassedForward: string;
  goodHandoff: string;
  doThisNext: string;
}

export interface PlaybookDeliverablePrompt {
  id: string;
  label: string;
  pageRef: string;
  snippet: string;
  applicableObjectives: string[];
  excludedObjectives?: string[];
  applicableKpis?: KPIType[];
  excludedKpis?: KPIType[];
}

export interface PlaybookIntegrationPartner {
  id: string;
  label: string;
  pageRef: string;
  isCorePlaybookStructure?: boolean;
  recommendedObjectives: string[];
  recommendedKpis: KPIType[];
  excludedObjectives?: string[];
  excludedKpis?: KPIType[];
  snippet: string;
}

/**
 * Core Golden Rule of the OneVoice27 Mission Playbook (Southern Asia-Pacific Division)
 * Ref: Page 3, Page 16, Page 28, Page 44
 */
export const PLAYBOOK_GOLDEN_RULE = {
  quote: 'Never start an activity unless someone is ready to respond and continue the relationship.',
  firstSuccessQuote:
    'A complete and compassionate handoff matters more than a large launch with no receiving pathway.',
  pageRef: 'Playbook pp. 3, 16, 28 & 44',
};

/**
 * 5-Stage Mission Pathway from the OneVoice27 Mission Playbook (Pages 10–15)
 * Mapped 1-to-1 to the 5 Primary KPIs in the Proposal Form.
 */
export const PLAYBOOK_PATHWAY_BY_KPI: Record<Exclude<KPIType, ''>, PlaybookPathwayStage> = {
  reach_exposure: {
    kpiId: 'reach_exposure',
    stageNumber: 1,
    stageName: 'Reach',
    pageRef: 'Playbook p. 11',
    purpose: 'Make hope visible and understandable.',
    whatHappens:
      'People encounter a message, service, invitation, testimony, broadcast, event, or personal witness.',
    whoLeads:
      'Communication, media ministries, creators, churches, institutions, and members.',
    whoSupports:
      'Prayer teams, departments, language reviewers, and digital missionaries.',
    whatGetsPassedForward:
      'A clear invitation (Call to Action) to watch, ask, pray, register, visit, or talk.',
    goodHandoff:
      'The person understands the next step and can act easily, with a named response owner ready.',
    doThisNext: 'Add one meaningful Call to Action and name the response owner.',
  },
  engagement_participation: {
    kpiId: 'engagement_participation',
    stageNumber: 2,
    stageName: 'Engage',
    pageRef: 'Playbook p. 12',
    purpose: 'Turn attention into respectful conversation.',
    whatHappens:
      'A trained person listens, answers, prays, and notices spiritual interest without pressure.',
    whoLeads: 'Digital missionaries, responders, prayer teams, and trained members.',
    whoSupports: 'Pastors, content teams, moderators, and language specialists.',
    whatGetsPassedForward:
      'The person’s consent, question, preferred channel, language, and agreed next step.',
    goodHandoff: 'The person feels heard and chooses whether to continue.',
    doThisNext:
      'Reply through the same channel and record only what the next person needs.',
  },
  connection_next_steps: {
    kpiId: 'connection_next_steps',
    stageNumber: 3,
    stageName: 'Connect',
    pageRef: 'Playbook p. 13',
    purpose: 'Move the relationship to a trusted person or community.',
    whatHappens:
      'The team offers a Bible worker, pastor, small group, bridging event, care partner, or local church.',
    whoLeads: 'Referral coordinators, NDR-IEL, fields, pastors, and local churches.',
    whoSupports:
      'Communication teams, digital missionaries, Bible workers, and Hope Care Teams.',
    whatGetsPassedForward:
      'A warm referral with consent and enough context for follow-up.',
    goodHandoff:
      'A named receiver (and backup) accepts the relationship and contacts the person.',
    doThisNext:
      'Confirm the primary receiver and backup before sharing personal information.',
  },
  retention_nurturing: {
    kpiId: 'retention_nurturing',
    stageNumber: 4,
    stageName: 'Disciple',
    pageRef: 'Playbook p. 14',
    purpose: 'Help the person know Jesus, follow Scripture, belong, and grow.',
    whatHappens:
      'The person studies, worships, builds friendships, receives pastoral care, and begins serving.',
    whoLeads:
      'Pastors, Bible workers, small groups, elders, Hope Care Teams, and trained members.',
    whoSupports:
      'Ministerial, Personal Ministries, NDR-IEL, care teams, and prayer partners.',
    whatGetsPassedForward:
      'A continuing plan for Bible study, local church belonging, pastoral care, and service.',
    goodHandoff: 'The person is growing in faith and has dependable relationships.',
    doThisNext: 'Agree on the next study, visit, small group, or act of service.',
  },
  implementation_capability: {
    kpiId: 'implementation_capability',
    stageNumber: 5,
    stageName: 'Multiply',
    pageRef: 'Playbook p. 15',
    purpose: 'Help growing disciples and members share their faith and serve others.',
    whatHappens:
      'Members and creators discover gifts, receive training, join a ministry team, and begin helping others.',
    whoLeads: 'Local churches, pastors, ministry leaders, union/field trainers, and mentors.',
    whoSupports:
      'Unions, fields, departments, digital missionary teams, and small groups.',
    whatGetsPassedForward:
      'A supported ministry role (creator, responder, care partner, study leader) and a community to serve.',
    goodHandoff:
      'The trained disciple participates with guidance and continues growing.',
    doThisNext: 'Offer one realistic ministry role with training and a named mentor.',
  },
};

/**
 * Playbook Deliverable Prompts for Section 6 (Pages 28, 29, 30, 37)
 */
export const PLAYBOOK_DELIVERABLE_PROMPTS: PlaybookDeliverablePrompt[] = [
  {
    id: 'content_repository',
    label: 'Contribute to OneVoice27 Content Repository (p. 29)',
    pageRef: 'Playbook pp. 29 & 37',
    snippet:
      'Approved master files, translations, and metadata contributed to the shared OneVoice27 Content Repository for regional reuse.',
    applicableObjectives: [
      'Proclamation Kits & Contextualized Evangelistic Materials',
      'Global Contextualized Media Production',
      'Short-Form Content',
      'Global Marketing Campaign',
    ],
    excludedObjectives: [
      'Regional Media Evangelism & Creators Conferences',
      'Proclamation & Harvesting Initiatives',
    ],
    excludedKpis: ['connection_next_steps', 'implementation_capability'],
  },
  {
    id: 'community_events_rsvp',
    label: 'Publish Community Event & Opt-In RSVP on HopeStartsHere.asia (pp. 9 & 13)',
    pageRef: 'Playbook pp. 9, 13 & 38',
    snippet:
      'Community outreach event schedule and opt-in RSVP registration published on HopeStartsHere.asia (following Play 7 sensitivity rules in restricted areas) and routed within 48 hours to named Local Bridge Coordinators and Hope Care Teams.',
    applicableObjectives: [
      'Proclamation & Harvesting Initiatives',
      'Proclamation Kits & Contextualized Evangelistic Materials',
      'Mission Intelligence: Reaching Unreached People Groups',
      'Global Marketing Campaign',
    ],
    excludedObjectives: ['Regional Media Evangelism & Creators Conferences'],
    applicableKpis: ['connection_next_steps', 'retention_nurturing'],
    excludedKpis: ['implementation_capability'],
  },
  {
    id: 'all_things_new_calendar',
    label: 'Align with "All Things New" 48-Week Calendar (p. 30)',
    pageRef: 'Playbook pp. 30–31',
    snippet:
      'Content and release schedule synchronized with the SSD "All Things New" 12-month / 48-week Integrated Calendar cycles.',
    applicableObjectives: [
      'Proclamation Kits & Contextualized Evangelistic Materials',
      'Global Contextualized Media Production',
      'Short-Form Content',
      'Proclamation & Harvesting Initiatives',
      'Global Marketing Campaign',
    ],
  },
  {
    id: 'cta_and_response_route',
    label: 'Include Media/Ad Call to Action & Response Route (p. 28)',
    pageRef: 'Playbook p. 28',
    snippet:
      'Every piece of media/ad includes one clear Call to Action (CTA) routed to HopeStartsHere.asia and a named Digital Missionary response team.',
    applicableObjectives: [
      'Proclamation Kits & Contextualized Evangelistic Materials',
      'Global Contextualized Media Production',
      'Short-Form Content',
      'Mission Intelligence: Reaching Unreached People Groups',
      'Global Marketing Campaign',
    ],
    excludedObjectives: [
      'Regional Media Evangelism & Creators Conferences',
      'Proclamation & Harvesting Initiatives',
    ],
    excludedKpis: ['connection_next_steps', 'implementation_capability'],
  },
  {
    id: 'seeker_ready_handoff_kit',
    label: 'Seeker-Ready Church & Bridging Handoff Guide (p. 34)',
    pageRef: 'Playbook pp. 34–35',
    snippet:
      'Local Church Readiness Checklist and warm-handoff protocol equipping Hope Care Teams and Interest Coordinators to receive referrals.',
    applicableObjectives: [
      'Regional Media Evangelism & Creators Conferences',
      'Proclamation Kits & Contextualized Evangelistic Materials',
      'Proclamation & Harvesting Initiatives',
    ],
  },
];

/**
 * Playbook Play 7 & Part 2 Guidance for Group E (Unreached / World Religions / Sensitive Contexts)
 * Ref: Page 8 ("The Mission Field") & Page 38 ("Play 7: A Seeker Lives in a Sensitive Area")
 */
export const PLAYBOOK_SENSITIVE_AREA_GUIDE = {
  title: 'OneVoice27 Playbook Guidance: Contextualization & Play 7 (pp. 8 & 38)',
  summary:
    'In Muslim, Buddhist, Hindu, secular, or 10/40 Window settings, keep biblical truth clear while adapting language, imagery, and pace. Where Christian interest creates personal risk, protect seekers with safe, consented contact routes.',
  snippets: [
    {
      id: 'play7_safe_referral',
      label: 'Insert Play 7 Sensitive-Area Safeguard (p. 38)',
      text: 'Following Playbook Play 7 (Sensitive Areas): Seekers will not be referred publicly to a local church without explicit consent; inquiries are routed through a trained sensitive-contact coordinator or approved online mentor until local contact is safe.',
    },
    {
      id: 'part2_contextualization',
      label: 'Insert Cultural & Language Contextualization Note (p. 8)',
      text: 'Following Playbook Part 2 (Contextualization): Materials and conversations will use local heart-language, culturally respectful idioms, and relatable life questions tailored to this specific people group.',
    },
  ],
};

/**
 * Upgraded SSD OneVoice27 Playbook Ecosystem Partners for Section 8 (Points of Integration)
 * Ref: Pages 9, 17–25, 26, 29, 30, 34, 53–54
 */
export const PLAYBOOK_INTEGRATION_PARTNERS: PlaybookIntegrationPartner[] = [
  {
    id: 'ndr_iel_ministerial',
    label: 'NDR-IEL & Ministerial',
    pageRef: 'Playbook pp. 17, 23, 54',
    isCorePlaybookStructure: true,
    recommendedObjectives: [
      'Proclamation & Harvesting Initiatives',
      'Proclamation Kits & Contextualized Evangelistic Materials',
      'Regional Media Evangelism & Creators Conferences',
      'Mission Intelligence: Reaching Unreached People Groups',
    ],
    recommendedKpis: ['connection_next_steps', 'retention_nurturing', 'implementation_capability'],
    snippet:
      'NDR-IEL & Ministerial Association (Playbook p. 23): Coordinating the evangelistic pathway, Bridging Events, interest assignment, and preparing pastors to receive and care for referred seekers.',
  },
  {
    id: 'hope_care_teams',
    label: 'Seeker-Ready Churches & Hope Care Teams',
    pageRef: 'Playbook pp. 17, 34–35, 53',
    isCorePlaybookStructure: true,
    recommendedObjectives: [
      'Proclamation & Harvesting Initiatives',
      'Global Marketing Campaign',
      'Proclamation Kits & Contextualized Evangelistic Materials',
    ],
    recommendedKpis: ['connection_next_steps', 'retention_nurturing'],
    snippet:
      'Seeker-Ready Local Churches & Hope Care Teams (Playbook p. 34): Naming a local Interest Coordinator, backup, and Hope Care Team at receiving churches to welcome warm referrals into small groups and Bible study.',
  },
  {
    id: 'digital_missionaries',
    label: 'Digital Missionaries & Responders',
    pageRef: 'Playbook pp. 26–27, 36',
    isCorePlaybookStructure: true,
    recommendedObjectives: [
      'Global Contextualized Media Production',
      'Short-Form Content',
      'Global Marketing Campaign',
      'Regional Media Evangelism & Creators Conferences',
      'Mission Intelligence: Reaching Unreached People Groups',
    ],
    recommendedKpis: ['reach_exposure', 'engagement_participation', 'connection_next_steps', 'implementation_capability'],
    snippet:
      'Digital Missionaries & Response Teams (Playbook p. 26): Trained online responders listening to comments/messages, praying with seekers, gaining consent, and executing warm handoffs to local receivers.',
  },
  {
    id: 'hopestartshere_events_rsvp',
    label: 'HopeStartsHere.asia Community Events & RSVP',
    pageRef: 'Playbook pp. 9, 13, 38',
    isCorePlaybookStructure: true,
    recommendedObjectives: [
      'Proclamation & Harvesting Initiatives',
      'Mission Intelligence: Reaching Unreached People Groups',
      'Global Marketing Campaign',
    ],
    recommendedKpis: ['connection_next_steps', 'retention_nurturing'],
    excludedObjectives: ['Regional Media Evangelism & Creators Conferences'],
    excludedKpis: ['implementation_capability'],
    snippet:
      'HopeStartsHere.asia Community Events & RSVP (Playbook pp. 9, 13, 38): Listing community outreach and bridging events with opt-in RSVP registration (keeping guest names and sensitive venues private under Play 7) and routing signups within 48 hours to named Local Bridge Coordinators and Hope Care Teams.',
  },
  {
    id: 'hopestartshere_content_repository',
    label: 'HopeStartsHere.asia Hub & Content Repository',
    pageRef: 'Playbook pp. 9, 29–31',
    isCorePlaybookStructure: true,
    recommendedObjectives: [
      'Global Contextualized Media Production',
      'Short-Form Content',
      'Global Marketing Campaign',
      'Proclamation Kits & Contextualized Evangelistic Materials',
    ],
    recommendedKpis: ['reach_exposure', 'engagement_participation'],
    excludedObjectives: [
      'Regional Media Evangelism & Creators Conferences',
      'Proclamation & Harvesting Initiatives',
    ],
    excludedKpis: ['connection_next_steps', 'implementation_capability'],
    snippet:
      'HopeStartsHere.asia Hub, Content Repository & "All Things New" Calendar (Playbook pp. 9, 29–30): Routing media/campaign CTAs through the unified SSD hub, contributing reusable master files to the Content Repository, and synchronizing releases with the 48-week Integrated Calendar.',
  },
  {
    id: 'hope_channel',
    label: 'Hope Channel',
    pageRef: 'Playbook p. 23',
    recommendedObjectives: [
      'Global Contextualized Media Production',
      'Short-Form Content',
      'Global Marketing Campaign',
      'Regional Media Evangelism & Creators Conferences',
    ],
    recommendedKpis: ['reach_exposure', 'engagement_participation'],
    snippet:
      'Hope Channel (Playbook p. 23): Co-producing and distributing contextualized video content, verifying doctrinal consistency, and routing viewer inquiries to local fields.',
  },
  {
    id: 'awr',
    label: 'Adventist World Radio (AWR)',
    pageRef: 'Playbook p. 23',
    recommendedObjectives: [
      'Global Contextualized Media Production',
      'Mission Intelligence: Reaching Unreached People Groups',
      'Proclamation & Harvesting Initiatives',
    ],
    recommendedKpis: ['reach_exposure', 'engagement_participation'],
    snippet:
      'Adventist World Radio (AWR) (Playbook p. 23): Broadcasting localized audio programs and routing listener prayer and Bible study requests into the field referral network.',
  },
  {
    id: 'sspm',
    label: 'Sabbath School & Personal Ministries',
    pageRef: 'Playbook pp. 14, 17',
    recommendedObjectives: [
      'Proclamation & Harvesting Initiatives',
      'Proclamation Kits & Contextualized Evangelistic Materials',
    ],
    recommendedKpis: ['connection_next_steps', 'retention_nurturing'],
    snippet:
      'Sabbath School & Personal Ministries (Playbook p. 17): Readying local church care groups, Bible workers, and Sabbath School classes to receive and nurture referred interests.',
  },
  {
    id: 'youth',
    label: 'Youth / Campus Ministries',
    pageRef: 'Playbook pp. 5, 26',
    recommendedObjectives: [
      'Regional Media Evangelism & Creators Conferences',
      'Short-Form Content',
    ],
    recommendedKpis: ['implementation_capability', 'engagement_participation'],
    snippet:
      'Youth & Young Adult Ministries: Mobilizing and mentoring young content creators and student digital missionaries for peer-to-peer online engagement.',
  },
  {
    id: 'adventist_mission',
    label: 'Adventist Mission / AMR',
    pageRef: 'Playbook pp. 8, 38',
    recommendedObjectives: [
      'Mission Intelligence: Reaching Unreached People Groups',
      'Proclamation Kits & Contextualized Evangelistic Materials',
    ],
    recommendedKpis: ['reach_exposure', 'engagement_participation', 'connection_next_steps'],
    snippet:
      'Adventist Mission / AMR (Playbook pp. 8, 38): Providing cultural contextualization, 10/40 Window mission intelligence, and safe sensitive-contact mentorship.',
  },
  {
    id: 'health_community',
    label: 'Health & Community Services (Bridging)',
    pageRef: 'Playbook pp. 9, 25, 37',
    recommendedObjectives: [
      'Proclamation & Harvesting Initiatives',
      'Mission Intelligence: Reaching Unreached People Groups',
    ],
    recommendedKpis: ['connection_next_steps'],
    snippet:
      'Health Ministries & Community Services (Playbook p. 9): Hosting practical community wellness and family Bridging Events where online contacts can meet local believers naturally.',
  },
];
