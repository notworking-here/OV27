import {
  Proposal,
  getCanonicalUnion,
  getCanonicalKpiType,
  getProposalPillarKey,
  getCanonicalDivisionProject,
} from '../types';

export type BridgingThemeId =
  | 'health'
  | 'family'
  | 'service'
  | 'learning'
  | 'faith'
  | 'youth'
  | 'seasonal';

export interface BridgingThemeMeta {
  id: BridgingThemeId;
  code: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  label: string;
  description: string;
}

export const BRIDGING_EVENT_THEMES: BridgingThemeMeta[] = [
  {
    id: 'health',
    code: 'A',
    label: 'Health & Wellness',
    description: 'Physical & mental well-being events answering universal felt needs across SSD.',
  },
  {
    id: 'family',
    code: 'B',
    label: 'Family & Relationships',
    description: 'Strengthening marriages, digital-age parenting, kids, and Pathfinder families.',
  },
  {
    id: 'service',
    code: 'C',
    label: 'Community Service (ADRA & Partners)',
    description: 'Practical compassion projects with unconditional care and voluntary referrals.',
  },
  {
    id: 'learning',
    code: 'D',
    label: 'Learning & Life Skills',
    description: 'Language cafés, financial literacy, senior digital skills, and student tutoring.',
  },
  {
    id: 'faith',
    code: 'E',
    label: 'Faith Exploration',
    description: 'Low-barrier hospitality spaces for spiritual questions, Hope viewers, and prayer.',
  },
  {
    id: 'youth',
    code: 'F',
    label: 'Youth & Young Adults',
    description: 'Sports fellowships, outdoor clubs, and creative studios building peer friendships.',
  },
  {
    id: 'seasonal',
    code: 'G',
    label: 'Seasonal & Community Celebrations',
    description: 'High-trust calendar touchpoints that connect online contacts with warm local churches.',
  },
];

export interface BridgingEventIdea {
  id: string;
  number: number;
  title: string;
  theme: BridgingThemeId;
  feltNeed: string;
  bridgeFromOnline: string;
  nextStepFollowUp: string;
  recommendedCountries: string[];
  restrictedAccessSafe: boolean;
  suggestedAudiences: string[];
  deliverablesSnippet: string;
  outcomesSnippet: string;
  integrationSnippet: string;
  budgetItems: string[];
}

export const BRIDGING_EVENT_IDEAS: BridgingEventIdea[] = [
  // A. Health & Wellness
  {
    id: 'be_01_fun_run',
    number: 1,
    title: '"All Things New" Fun Run / Walk for Life',
    theme: 'health',
    feltNeed: 'Fitness, stress relief, and community belonging',
    bridgeFromOnline: 'Promote a free community run in city parks via digital channels; include a health booth and a photo/QR point.',
    nextStepFollowUp: 'Invite runners to a weekly walking club or 8-week health challenge hosted by local church members.',
    recommendedCountries: ['Philippines', 'Indonesia', 'Singapore', 'Malaysia', 'Thailand'],
    restrictedAccessSafe: true,
    suggestedAudiences: ['C', 'D', 'E'],
    deliverablesSnippet:
      'Host "All Things New" Fun Run / Walk for Life with welcome hospitality booth, QR opt-in Health Passport, and 1:1 Bridge Friend greeters.',
    outcomesSnippet:
      'Runners and online registrants transition from a single fitness gathering into an 8-week neighborhood walking club and health-care friendship group within 30 days.',
    integrationSnippet:
      'Local Church Health Ministries, Local Bridge Coordinator, and Hope Care Teams contact online opt-in signups within 48 hours and pair each guest with a Bridge Friend.',
    budgetItems: [
      '2-Hour "Welcoming Online Guests" Greeter & Bridge Friend Training',
      'Event Permits, Route Hydration & Community Health Booth Setup',
      'Welcome Desk Name Tags, QR Opt-In Cards & Health Passports',
    ],
  },
  {
    id: 'be_02_health_expo',
    number: 2,
    title: 'Community Health Expo (8 Laws of Health / CELEBRATIONS)',
    theme: 'health',
    feltNeed: 'Preventive health checks, chronic disease awareness, and holistic wellness',
    bridgeFromOnline: 'Invite online followers and social media ad leads for a free Health Age screening and consultation.',
    nextStepFollowUp: 'Offer a 4-week CHIP / CELEBRATIONS follow-up group at the church or a local community hall.',
    recommendedCountries: ['Philippines', 'Indonesia', 'Malaysia', 'Singapore', 'Cambodia', 'Thailand'],
    restrictedAccessSafe: true,
    suggestedAudiences: ['C', 'D', 'E'],
    deliverablesSnippet:
      'Conduct Community Health Expo (CELEBRATIONS / 8 Laws) offering free preventive screenings and pre-scheduled 4-week wellness group signups.',
    outcomesSnippet:
      'Screened community guests build personal relationships with local church volunteers and enroll in ongoing 4-week CELEBRATIONS small groups.',
    integrationSnippet:
      'Adventist Hospitals/Clinics, Union Health Ministries, and Local Bridge Coordinators sustain unconditional health care with consented follow-up referrals within 48 hours.',
    budgetItems: [
      '2-Hour "Welcoming Online Guests" Greeter & Bridge Friend Training',
      'Community Health Screening Supplies & Health Passports',
      'Venue Rental, Booth Signage & Follow-Up Wellness Class Kits',
    ],
  },
  {
    id: 'be_03_plant_based_cooking',
    number: 3,
    title: 'Plant-Based Cooking Classes',
    theme: 'health',
    feltNeed: 'Affordable, healthy family meals and chronic lifestyle improvement',
    bridgeFromOnline: 'Share short-form local recipe reels online and offer an in-person hands-on cooking workshop.',
    nextStepFollowUp: 'Provide a take-home recipe booklet and invite guests to a monthly fellowship meal or small home table.',
    recommendedCountries: ['Philippines', 'Indonesia', 'Malaysia', 'Singapore', 'Vietnam', 'Thailand', 'Laos'],
    restrictedAccessSafe: true,
    suggestedAudiences: ['C', 'D', 'E'],
    deliverablesSnippet:
      'Deliver hands-on Plant-Based Cooking Classes bridged from short-form recipe videos, complete with printed recipe booklets and pre-scheduled next-month table invitations.',
    outcomesSnippet:
      'Online recipe viewers experience warm local hospitality in person and join recurring neighborhood fellowship meals and wellness circles.',
    integrationSnippet:
      'Local Church Women’s/Health Ministries and Short-Form Media Teams route opt-in registrants via Bridge Friends within 48 hours of registration and attendance.',
    budgetItems: [
      '2-Hour "Welcoming Online Guests" Greeter & Bridge Friend Training',
      'Cooking Demonstration Ingredients, Utensils & Tasting Supplies',
      'Printed Recipe Booklets, Opt-In Interest Cards & Welcome Gifts',
    ],
  },
  {
    id: 'be_04_mental_wellness',
    number: 4,
    title: 'Stress, Depression & Mental Wellness Seminar',
    theme: 'health',
    feltNeed: 'Anxiety, burnout, grief, and emotional resilience for students and workers',
    bridgeFromOnline: 'Follow online mental-health reels and posts with a live Q&A seminar featuring trained Christian counselors.',
    nextStepFollowUp: 'Launch a confidential peer-support care group and offer personal prayer and pastoral listening with consent.',
    recommendedCountries: ['Philippines', 'Indonesia', 'Singapore', 'Malaysia', 'Thailand'],
    restrictedAccessSafe: true,
    suggestedAudiences: ['C', 'D', 'E'],
    deliverablesSnippet:
      'Host Stress & Mental Wellness Seminar with licensed counselors, Q&A table discussions, and pre-scheduled weekly peer-support care circles.',
    outcomesSnippet:
      'Participants struggling with stress receive trusted emotional tools, form a connection with a matched Bridge Friend, and enter weekly care groups.',
    integrationSnippet:
      'Adventist Health/Counseling Professionals, Campus Ministries, and Hope Care Teams protect guest privacy (opt-in consent) and follow up within 48 hours.',
    budgetItems: [
      '2-Hour "Welcoming Online Guests" Greeter & Bridge Friend Training',
      'Counselor / Facilitator Honoraria & Seminar Venue Setup',
      'Mental Wellness Workbooks, Welcome Desk Cards & Refreshments',
    ],
  },
  {
    id: 'be_05_breathe_free',
    number: 5,
    title: 'Breathe Free / Quit Smoking & Vaping Plan',
    theme: 'health',
    feltNeed: 'Breaking tobacco, vaping, and nicotine dependence for youth and adults',
    bridgeFromOnline: 'Run targeted short-form video ads to youth and adult smokers offering a free 5-day support plan.',
    nextStepFollowUp: 'Assign each participant a buddy ("Bridge Friend") for daily check-ins and celebrate graduation with family.',
    recommendedCountries: ['Indonesia', 'Philippines', 'Vietnam', 'Thailand', 'Malaysia'],
    restrictedAccessSafe: true,
    suggestedAudiences: ['C', 'D', 'E'],
    deliverablesSnippet:
      'Run 5-day Breathe Free / Quit Vaping cohorts pairing every registrant with a 1:1 Bridge Friend buddy and hosting a family graduation dinner.',
    outcomesSnippet:
      'Participants complete the 5-day quit plan with personal encouragement and maintain ongoing accountability in a post-program friendship group.',
    integrationSnippet:
      'Youth/Health Ministries, Digital Response Teams, and Local Bridge Coordinators match buddies by age/gender/language within 48 hours.',
    budgetItems: [
      '2-Hour "Welcoming Online Guests" Greeter & Bridge Friend Training',
      'Breathe Free Participant Guides & Carbon-Monoxide Screening Supplies',
      'Cohort Hospitality & Family Graduation Celebration Meal',
    ],
  },

  // B. Family & Relationships
  {
    id: 'be_06_marriage_enrichment',
    number: 6,
    title: 'Marriage Enrichment Dinner / Couples Retreat',
    theme: 'family',
    feltNeed: 'Stronger communication, conflict resolution, and marriage resilience',
    bridgeFromOnline: 'Promote a "Date Night with Purpose" table event for couples engaging with online family content.',
    nextStepFollowUp: 'Connect couples into a monthly neighborhood couples’ fellowship and optional family devotion circle.',
    recommendedCountries: ['Philippines', 'Indonesia', 'Malaysia', 'Singapore', 'Thailand'],
    restrictedAccessSafe: true,
    suggestedAudiences: ['B', 'C', 'D', 'E'],
    deliverablesSnippet:
      'Organize a "Date Night with Purpose" Marriage Enrichment Dinner with guided table conversations and pre-scheduled monthly couples’ group dates.',
    outcomesSnippet:
      'Visiting couples build trusted friendships with host couples and join a monthly neighborhood couples’ fellowship within 30 days.',
    integrationSnippet:
      'Family Ministries, Local Pastors, and Host Couples coordinate opt-in invitations and conduct 48-hour post-dinner check-ins.',
    budgetItems: [
      '2-Hour "Welcoming Online Guests" Greeter & Bridge Friend Training',
      'Couples Dinner Venue, Catering & Table Hospitality',
      'Marriage Conversation Guides & Welcome Gifts',
    ],
  },
  {
    id: 'be_07_parenting_workshops',
    number: 7,
    title: 'Parenting Workshops & "Smart Parenting in a Digital World"',
    theme: 'family',
    feltNeed: 'Screen-time boundaries, adolescent emotional health, and family harmony',
    bridgeFromOnline: 'Reach parents via parenting reels and partner with local schools/PTAs for an open seminar.',
    nextStepFollowUp: 'Form small parenting circles at church or local cafés using pre-scheduled follow-up session dates.',
    recommendedCountries: ['Philippines', 'Singapore', 'Malaysia', 'Indonesia', 'Vietnam', 'Thailand'],
    restrictedAccessSafe: true,
    suggestedAudiences: ['B', 'C', 'D', 'E'],
    deliverablesSnippet:
      'Conduct "Smart Parenting in a Digital World" workshops in school or community venues with take-home family guides and monthly parent-circle signups.',
    outcomesSnippet:
      'Parents gain practical digital-safety habits and connect into ongoing peer parenting circles led by local church families.',
    integrationSnippet:
      'Adventist Education, Family Ministries, and Local Bridge Coordinators collaborate with PTAs while routing consenting leads via 48-hour follow-up.',
    budgetItems: [
      '2-Hour "Welcoming Online Guests" Greeter & Bridge Friend Training',
      'Workshop Venue, AV Setup & Parent Hospitality',
      'Smart Parenting Handbooks & Welcome Desk Sign-In Cards',
    ],
  },
  {
    id: 'be_08_kids_holiday_club',
    number: 8,
    title: "Kids' Holiday Club / VBS / Day Camp",
    theme: 'family',
    feltNeed: 'Safe, values-based school-holiday activities for children and working parents',
    bridgeFromOnline: 'Use social media and neighborhood outreach to invite families with children ages 5–12.',
    nextStepFollowUp: 'Host a Friday evening / Sabbath morning Family Finale and invite families into weekly children/parent clubs.',
    recommendedCountries: ['Philippines', 'Indonesia', 'Timor-Leste', 'Cambodia', 'Malaysia', 'Myanmar'],
    restrictedAccessSafe: true,
    suggestedAudiences: ['C', 'D', 'E'],
    deliverablesSnippet:
      "Execute a multi-day Kids' Holiday Club / Day Camp with parent hospitality lounge, trained Bridge Friends, and a pre-scheduled Family Finale & ongoing kids' club.",
    outcomesSnippet:
      'Visiting children and parents build warm trust with church families and attend a second church/club gathering within 30 days.',
    integrationSnippet:
      'Children’s Ministries, Youth Volunteers, and Hope Care Teams welcome parents during drop-off/pick-up and follow up with consented families within 48 hours.',
    budgetItems: [
      '2-Hour "Welcoming Online Guests" Greeter & Bridge Friend Training',
      'Kids Craft Kits, Activity Supplies & Child-Safety Lanyards',
      'Family Finale Meal & Parent Lounge Refreshments',
    ],
  },
  {
    id: 'be_09_pathfinder_open_day',
    number: 9,
    title: 'Pathfinder & Adventurer Open Day',
    theme: 'family',
    feltNeed: 'Positive character-building, outdoor skills, and healthy peer groups for youth',
    bridgeFromOnline: 'Run an exciting outdoor skill showcase (knots, first aid, camping, marching) promoted online to community parents.',
    nextStepFollowUp: 'Invite non-Adventist children and parents to join the next regular weekly club meeting and family campout.',
    recommendedCountries: ['Philippines', 'Indonesia', 'Timor-Leste', 'Myanmar', 'Malaysia'],
    restrictedAccessSafe: false,
    suggestedAudiences: ['A3', 'C', 'D'],
    deliverablesSnippet:
      'Host a Pathfinder & Adventurer Open Day skills fair in a park or schoolyard with guest welcome table and next-meeting club registration.',
    outcomesSnippet:
      'Community youth and parents enroll in regular weekly Pathfinder/Adventurer club sessions alongside church peers.',
    integrationSnippet:
      'Youth/Pathfinder Directors and Local Bridge Coordinators pair each visiting family with a host club family within 48 hours.',
    budgetItems: [
      '2-Hour "Welcoming Online Guests" Greeter & Bridge Friend Training',
      'Outdoor Skills Station Gear, First Aid Demos & Club Uniform Demos',
      'Open Day Refreshments & Club Welcome Packets',
    ],
  },

  // C. Community Service (with ADRA & local partners)
  {
    id: 'be_10_serve_together',
    number: 10,
    title: '"Serve Together" Volunteer Days',
    theme: 'service',
    feltNeed: 'Civic care, neighborhood clean-ups, tree planting, and purposeful community action',
    bridgeFromOnline: 'Recruit online followers to serve alongside church members in barangay/kampung clean-ups or school painting.',
    nextStepFollowUp: 'Debrief over a shared appreciation meal and invite volunteers to a next-month project or friendship small group.',
    recommendedCountries: ['Philippines', 'Indonesia', 'Singapore', 'Malaysia', 'Thailand', 'Timor-Leste'],
    restrictedAccessSafe: true,
    suggestedAudiences: ['A3', 'C', 'D', 'E'],
    deliverablesSnippet:
      'Coordinate "Serve Together" community volunteer days uniting online followers and local members, concluding with a shared meal and pre-scheduled next service date.',
    outcomesSnippet:
      'Online contacts experience authentic Christian friendship side-by-side in service and join recurring volunteer or home fellowship circles.',
    integrationSnippet:
      'ADRA, Adventist Community Services, and LGU/community leaders deliver unconditional civic service with voluntary, opt-in spiritual invitations.',
    budgetItems: [
      '2-Hour "Welcoming Online Guests" Greeter & Bridge Friend Training',
      'Service Project Tools, Clean-Up / Painting Supplies & Safety Gear',
      'Shared Volunteer Appreciation Meal & Welcome Cards',
    ],
  },
  {
    id: 'be_11_blood_donation',
    number: 11,
    title: 'Blood Donation Drive',
    theme: 'service',
    feltNeed: 'Urgent hospital blood supply needs and civic solidarity',
    bridgeFromOnline: 'Co-brand with Adventist hospitals or Red Cross and mobilize online young adults to donate.',
    nextStepFollowUp: 'Follow up with thank-you messages, healthy lifestyle tips, and an invitation to an upcoming community café or health seminar.',
    recommendedCountries: ['Philippines', 'Indonesia', 'Singapore', 'Malaysia', 'Thailand'],
    restrictedAccessSafe: true,
    suggestedAudiences: ['C', 'D', 'E'],
    deliverablesSnippet:
      'Organize a co-branded Blood Donation Drive with hospital/Red Cross partners, donor recovery hospitality desk, and opt-in health follow-up.',
    outcomesSnippet:
      'First-time and returning community donors feel personally appreciated by trained hosts and opt into ongoing wellness or community events.',
    integrationSnippet:
      'Adventist Hospitals/Red Cross, Youth Ministries, and Local Bridge Coordinators conduct unconditional health care and 48-hour thank-you follow-up for consenting donors.',
    budgetItems: [
      '2-Hour "Welcoming Online Guests" Greeter & Bridge Friend Training',
      'Donor Recovery Refreshments & Care Packages',
      'Partner Signage & Opt-In Health Follow-Up Cards',
    ],
  },
  {
    id: 'be_12_disaster_prep',
    number: 12,
    title: 'Disaster Preparedness & First Aid Training',
    theme: 'service',
    feltNeed: 'Practical typhoon, flood, earthquake, and emergency household readiness',
    bridgeFromOnline: 'Offer practical emergency certification to high-risk urban and coastal online audiences.',
    nextStepFollowUp: 'Organize neighborhood care circles and ongoing safety/health community check-ins.',
    recommendedCountries: ['Philippines', 'Indonesia', 'Myanmar', 'Timor-Leste', 'Vietnam', 'Cambodia'],
    restrictedAccessSafe: true,
    suggestedAudiences: ['C', 'D', 'E'],
    deliverablesSnippet:
      'Deliver certified First Aid & Disaster Preparedness workshops bridged from local online campaigns, establishing pre-scheduled neighborhood care check-ins.',
    outcomesSnippet:
      'Neighbors gain life-saving preparedness skills and form lasting trust with local church responders and Bridge Friends.',
    integrationSnippet:
      'ADRA / ACS, Barangay/Village Leaders, and Local Bridge Coordinators provide unconditional training regardless of religious response, referring only consenting participants.',
    budgetItems: [
      '2-Hour "Welcoming Online Guests" Greeter & Bridge Friend Training',
      'First Aid Training Kits, Manikins & Emergency Go-Bag Samples',
      'Trainer Stipends, Certificates & Community Hospitality',
    ],
  },
  {
    id: 'be_13_community_meal',
    number: 13,
    title: 'Community Meal / Feeding Programme',
    theme: 'service',
    feltNeed: 'Food security, warmth, and dignity for vulnerable families and students',
    bridgeFromOnline: 'Invite online contacts not only to receive support but also to volunteer, cook, and eat together around shared tables.',
    nextStepFollowUp: 'Build weekly table relationships and gently offer home visits, prayer support, or Bible discovery with consent.',
    recommendedCountries: ['Philippines', 'Cambodia', 'Timor-Leste', 'Myanmar', 'Indonesia'],
    restrictedAccessSafe: true,
    suggestedAudiences: ['C', 'D', 'E'],
    deliverablesSnippet:
      'Host recurring Community Meal / Shared Table gatherings where volunteers and neighbors eat together, supported by Bridge Friend hosts and voluntary prayer/care invitations.',
    outcomesSnippet:
      'Vulnerable families and online co-volunteers experience dignity, regular social belonging, and trusted pastoral care within 30 days.',
    integrationSnippet:
      'ADRA / Adventist Community Services and Hope Care Teams provide unconditional meals (never conditioned on religious attendance) and voluntary consented follow-up.',
    budgetItems: [
      '2-Hour "Welcoming Online Guests" Greeter & Bridge Friend Training',
      'Nutritious Community Meal Ingredients & Kitchen Supplies',
      'Table Hospitality & Voluntary Care/Prayer Response Cards',
    ],
  },

  // D. Learning & Life Skills
  {
    id: 'be_14_english_club',
    number: 14,
    title: 'English Club / Language Café',
    theme: 'learning',
    feltNeed: 'Practical spoken English, career confidence, and international friendship',
    bridgeFromOnline: 'Invite young adults and students reached online to weekly free conversation tables with trained volunteers.',
    nextStepFollowUp: 'Progress from everyday topics to values, life purpose, and optional English Bible stories with Bridge Friends.',
    recommendedCountries: ['Vietnam', 'Thailand', 'Cambodia', 'Laos', 'Indonesia', 'Myanmar'],
    restrictedAccessSafe: true,
    suggestedAudiences: ['C', 'E'],
    deliverablesSnippet:
      'Launch weekly English Club / Language Café conversation tables bridged from online youth outreach, pairing learners with 1:1 Bridge Friend table hosts.',
    outcomesSnippet:
      'Students and young professionals build weekly friendships with church hosts and naturally enter values-based and optional Bible-story discussions.',
    integrationSnippet:
      'Adventist Language Centers, Student/Youth Volunteers, and Local Bridge Coordinators maintain compliant small-group hospitality and 48-hour new-guest follow-up.',
    budgetItems: [
      '2-Hour "Welcoming Online Guests" Greeter & Bridge Friend Training',
      'Language Café Conversation Cards & Curriculum Booklets',
      'Café Coffee/Tea Refreshments & Venue Space',
    ],
  },
  {
    id: 'be_15_financial_freedom',
    number: 15,
    title: 'Financial Freedom & Small Business Seminar',
    theme: 'learning',
    feltNeed: 'Debt relief, household budgeting, and small-enterprise stewardship',
    bridgeFromOnline: 'Promote practical budgeting and micro-business workshops on social media to young families and entrepreneurs.',
    nextStepFollowUp: 'Continue with a 6-week stewardship small group hosted by trusted church mentors.',
    recommendedCountries: ['Philippines', 'Indonesia', 'Malaysia', 'Singapore', 'Thailand', 'Timor-Leste'],
    restrictedAccessSafe: true,
    suggestedAudiences: ['B', 'C', 'D', 'E'],
    deliverablesSnippet:
      'Deliver Financial Freedom & Small Business seminars with practical household budgeting worksheets and pre-scheduled 6-week stewardship small-group cohorts.',
    outcomesSnippet:
      'Families implement debt-free budgeting habits and join 6-week mentored small groups that integrate biblical principles of stewardship.',
    integrationSnippet:
      'Stewardship / Christian Business Leaders and Local Bridge Coordinators onboard registrants within 48 hours and host weekly small groups.',
    budgetItems: [
      '2-Hour "Welcoming Online Guests" Greeter & Bridge Friend Training',
      'Printed Budgeting Workbooks & Facilitator Honoraria',
      'Seminar Hall Rental & Light Refreshments',
    ],
  },
  {
    id: 'be_16_digital_skills',
    number: 16,
    title: 'Digital Skills for Seniors & Parents',
    theme: 'learning',
    feltNeed: 'Smartphone confidence, online scam protection, and staying connected with family',
    bridgeFromOnline: 'Equip intergenerational church youth to teach practical phone/safety skills promoted through neighborhood and online posts.',
    nextStepFollowUp: 'Build weekly warm intergenerational friendships and invite seniors and parents to Sabbath hospitality lunches.',
    recommendedCountries: ['Singapore', 'Malaysia', 'Philippines', 'Thailand', 'Indonesia'],
    restrictedAccessSafe: true,
    suggestedAudiences: ['A3', 'C', 'D', 'E'],
    deliverablesSnippet:
      'Host intergenerational Digital Skills & Scam-Safety clinics where church youth coach seniors/parents 1-on-1 and schedule bi-weekly help desks.',
    outcomesSnippet:
      'Seniors and parents gain online safety skills while forming ongoing 1:1 friendships with youth Bridge Friends and attending hospitality gatherings.',
    integrationSnippet:
      'Youth Ministries, Senior Ministries, and Local Bridge Coordinators pair each guest 1:1 and follow up within 48 hours.',
    budgetItems: [
      '2-Hour "Welcoming Online Guests" Greeter & Bridge Friend Training',
      'Large-Print Smartphone & Scam-Safety Guides',
      'Tea/Snack Hospitality & Clinic Table Supplies',
    ],
  },
  {
    id: 'be_17_career_tutoring',
    number: 17,
    title: 'Career & Study Fair / Tutoring Centre',
    theme: 'learning',
    feltNeed: 'Academic tutoring, scholarship guidance, and career mentorship for youth',
    bridgeFromOnline: 'Connect high school and university seekers online to free tutoring, career coaching, or scholarship booths.',
    nextStepFollowUp: 'Pair students with Christian mentors for ongoing weekly study circles and campus fellowship.',
    recommendedCountries: ['Indonesia', 'Philippines', 'Cambodia', 'Laos', 'Vietnam', 'Timor-Leste'],
    restrictedAccessSafe: true,
    suggestedAudiences: ['A3', 'C', 'D', 'E'],
    deliverablesSnippet:
      'Establish a Career & Study Fair / Weekly Tutoring Hub connecting online student inquiries to trained Christian academic mentors and pre-scheduled study circles.',
    outcomesSnippet:
      'Students receive consistent educational support and transition into supportive campus/youth friendship circles within 30 days.',
    integrationSnippet:
      'Adventist Schools/Universities, Public Campus Ministries (PCM), and Local Bridge Coordinators track opt-in mentorship pairs with 48-hour response.',
    budgetItems: [
      '2-Hour "Welcoming Online Guests" Greeter & Bridge Friend Training',
      'Study Hub Whiteboards, Tutoring Materials & Mentorship Guides',
      'Student Refreshments & Career Booth Displays',
    ],
  },

  // E. Faith Exploration (soft & welcoming)
  {
    id: 'be_18_coffee_questions',
    number: 18,
    title: '"Coffee & Questions" / Faith Café',
    theme: 'faith',
    feltNeed: 'Safe, non-judgmental space to ask honest questions about faith, hope, and life',
    bridgeFromOnline: 'Invite online commentors and DM seekers from digital Q&A videos to an informal café conversation.',
    nextStepFollowUp: 'Transition interested guests into a 4-session "Discovery" small group in a home or café setting.',
    recommendedCountries: ['Singapore', 'Philippines', 'Indonesia', 'Malaysia', 'Thailand'],
    restrictedAccessSafe: true,
    suggestedAudiences: ['C', 'D', 'E'],
    deliverablesSnippet:
      'Host "Coffee & Questions" Faith Café tables for online Q&A seekers, featuring warm 1:1 Bridge Friend hosts and pre-scheduled 4-week Discovery groups.',
    outcomesSnippet:
      'Digital questioners meet a real local friend face-to-face and step comfortably into a 4-session Discovery small group.',
    integrationSnippet:
      'Digital Missionaries, Hope Care Teams, and Local Bridge Coordinators transfer consented DM leads via allthingsnew.com/HopeStartsHere within 48 hours.',
    budgetItems: [
      '2-Hour "Welcoming Online Guests" Greeter & Bridge Friend Training',
      'Café Venue / Coffee & Pastry Hospitality',
      'Discovery Conversation Cards & Welcome Gifts',
    ],
  },
  {
    id: 'be_19_bible_graduation',
    number: 19,
    title: 'Bible Course Graduation Ceremony',
    theme: 'faith',
    feltNeed: 'Recognition, milestone celebration, and warm community belonging',
    bridgeFromOnline: 'Celebrate online Voice of Prophecy / Hope Bible School students in person with certificates and shared meals.',
    nextStepFollowUp: 'Invite graduates and their families into local Sabbath morning classes or home Bible study circles.',
    recommendedCountries: ['Philippines', 'Indonesia', 'Myanmar', 'Timor-Leste', 'Malaysia'],
    restrictedAccessSafe: false,
    suggestedAudiences: ['C', 'D'],
    deliverablesSnippet:
      'Organize a warm Bible Course Graduation Ceremony honoring online/correspondence Bible students alongside assigned local Bridge Friends and next-step study hosts.',
    outcomesSnippet:
      'Solo online Bible students transition into supportive local church fellowship and continue into deeper Sabbath School or baptismal studies.',
    integrationSnippet:
      'Adventist Discovery / Bible Schools, Hope Care Teams, and District Pastors match each graduate with a Bridge Friend 48 hours prior to graduation.',
    budgetItems: [
      '2-Hour "Welcoming Online Guests" Greeter & Bridge Friend Training',
      'Graduation Certificates, Bibles & Keepsake Gifts',
      'Fellowship Lunch & Ceremony Venue Setup',
    ],
  },
  {
    id: 'be_20_watch_party',
    number: 20,
    title: "Watch Party / Hope Viewers' Rally",
    theme: 'faith',
    feltNeed: 'Shared dialogue and real community around trusted Hope Channel / All Things New media',
    bridgeFromOnline: 'Invite regular broadcast/social viewers in a city or district to meet the presenters and talk together in person.',
    nextStepFollowUp: 'Form district-based home watch groups or local church small groups with pre-scheduled weekly dates.',
    recommendedCountries: ['Philippines', 'Indonesia', 'Myanmar', 'Thailand', 'Singapore', 'Malaysia'],
    restrictedAccessSafe: true,
    suggestedAudiences: ['C', 'D'],
    deliverablesSnippet:
      "Host district Watch Parties / Hope Viewers' Gatherings (large hall or home small-group format in sensitive areas) with live discussion and next-week watch group signups.",
    outcomesSnippet:
      'Passive broadcast and digital viewers move from screen isolation into weekly neighborhood watch-and-discussion fellowships.',
    integrationSnippet:
      'Hope Channel / Communication Teams, NDR-IEL, and Local Bridge Coordinators route opted-in viewers to nearby hosts within 48 hours.',
    budgetItems: [
      '2-Hour "Welcoming Online Guests" Greeter & Bridge Friend Training',
      'Screening AV Setup / District Hall or Home Host Kits',
      'Viewer Hospitality Refreshments & Discussion Guides',
    ],
  },
  {
    id: 'be_21_sabbath_open_house',
    number: 21,
    title: 'Sabbath Open House / Friendship Lunch',
    theme: 'faith',
    feltNeed: 'Hospitality, rest, and overcoming hesitation about visiting a church for the first time',
    bridgeFromOnline: 'Host a welcoming "Guest Sabbath" promoted to online friends, personally greeting visitors at the door.',
    nextStepFollowUp: 'Pair every guest with a host family for Sabbath potluck/lunch and pre-schedule a midweek home visit or study.',
    recommendedCountries: ['All 11 SSD Countries'],
    restrictedAccessSafe: true,
    suggestedAudiences: ['C', 'D'],
    deliverablesSnippet:
      'Implement a "Guest Sabbath" Open House & Friendship Lunch with pre-paired 1:1 Bridge Friends greeting guests by name at the door and hosting shared meals.',
    outcomesSnippet:
      'Online seekers cross the church threshold comfortably with a trusted friend and continue into midweek small groups and Sabbath belonging at 3 and 6 months.',
    integrationSnippet:
      'Local Church Elders, Sabbath School / Interest Coordinators, and Hope Care Teams greet online guests and confirm 48-hour post-visit contact.',
    budgetItems: [
      '2-Hour "Welcoming Online Guests" Greeter & Bridge Friend Training',
      'Friendship Lunch Hospitality & Table Supplies',
      'Welcome Desk Name Tags & Visitor Welcome Packs',
    ],
  },
  {
    id: 'be_22_prayer_walk',
    number: 22,
    title: 'Prayer Walk & Prayer Visit Teams',
    theme: 'faith',
    feltNeed: 'Personal prayer support during illness, grief, family crisis, or unemployment',
    bridgeFromOnline: 'Respond to online prayer requests with a consented home visit, small gift, or personal prayer call within 48 hours.',
    nextStepFollowUp: 'Follow up weekly on answered prayers and invite interested households to a home prayer & Bible fellowship.',
    recommendedCountries: ['All 11 SSD Countries'],
    restrictedAccessSafe: true,
    suggestedAudiences: ['B', 'C', 'D', 'E'],
    deliverablesSnippet:
      'Deploy trained Prayer Visit Teams responding to opted-in online prayer requests within 48 hours with home visits/calls, care gifts, and weekly prayer circle invites.',
    outcomesSnippet:
      'Individuals who submit digital prayer needs experience compassionate personal presence and enter ongoing neighborhood prayer fellowships.',
    integrationSnippet:
      'Prayer Ministries, Digital Responders, and Local Hope Care Teams honor strict privacy and voluntary opt-in consent before any home visit.',
    budgetItems: [
      '2-Hour "Welcoming Online Guests" Greeter & Bridge Friend Training',
      'Care Visit Gift Packs & Prayer Journal Cards',
      'Local Prayer Team Transport & Coordination Support',
    ],
  },
  {
    id: 'be_23_concerts_of_hope',
    number: 23,
    title: 'Concerts of Hope / Music Nights',
    theme: 'faith',
    feltNeed: 'Uplifting culture, emotional encouragement, and shared hope in public spaces',
    bridgeFromOnline: 'Use choirs, youth bands, and online viral musicians to draw online followers to a live public/campus venue.',
    nextStepFollowUp: 'Use QR interest cards and trained connection teams on-site to invite guests to next-week small groups and Faith Cafés.',
    recommendedCountries: ['Philippines', 'Indonesia', 'Myanmar', 'Thailand', 'Timor-Leste'],
    restrictedAccessSafe: false,
    suggestedAudiences: ['C', 'D'],
    deliverablesSnippet:
      'Produce Concerts of Hope with trained on-site Bridge Friend connection teams, QR opt-in interest capture, and a pre-scheduled next-week Faith Café.',
    outcomesSnippet:
      'Concert attendees opt into personal follow-up within 48 hours and join follow-on small groups rather than leaving a dead-end event.',
    integrationSnippet:
      'Music/Youth Ministries, Communication Teams, and Local Bridge Coordinators staff connection booths and assign 1:1 follow-up within 48 hours.',
    budgetItems: [
      '2-Hour "Welcoming Online Guests" Greeter & Bridge Friend Training',
      'Concert Venue, Stage Sound & Lighting Rental',
      'QR Opt-In Connection Booths, Cards & Musician Hospitality',
    ],
  },

  // F. Youth & Young Adults
  {
    id: 'be_24_sports_leagues',
    number: 24,
    title: 'Sports Leagues & Fellowship',
    theme: 'youth',
    feltNeed: 'Healthy recreation, teamwork, and positive peer friendships (futsal, basketball, badminton, volleyball, cricket)',
    bridgeFromOnline: 'Invite non-Adventist youth reached on TikTok/Instagram/Facebook to join local church or campus sports nights.',
    nextStepFollowUp: 'Include a brief 5-minute halftime reflection or post-game fellowship meal and invite teammates to youth small groups.',
    recommendedCountries: ['Philippines', 'Indonesia', 'Timor-Leste', 'Malaysia', 'Myanmar', 'Singapore'],
    restrictedAccessSafe: true,
    suggestedAudiences: ['A3', 'C', 'D', 'E'],
    deliverablesSnippet:
      'Run multi-week Sports Leagues & Fellowship nights (futsal/basketball/badminton/volleyball) with halftime relational check-ins and post-game youth group invites.',
    outcomesSnippet:
      'Unchurched youth invited online become regular teammates with Adventist youth Bridge Friends and attend youth small groups within 30 days.',
    integrationSnippet:
      'Youth Ministries, Adventist Schools/Campuses, and Local Bridge Coordinators embed trained youth hosts onto every mixed team.',
    budgetItems: [
      '2-Hour "Welcoming Online Guests" Greeter & Bridge Friend Training',
      'Court / Field Rental & Sports Equipment',
      'Post-Game Fellowship Refreshments & Team Jerseys/Tags',
    ],
  },
  {
    id: 'be_25_hike_camp_photo',
    number: 25,
    title: 'Hike, Camp & Photo Walk Clubs',
    theme: 'youth',
    feltNeed: 'Nature connection, mental reset, creative hobbies, and authentic community',
    bridgeFromOnline: 'Create weekend outdoor clubs promoted via Instagram/TikTok for young professionals and university students.',
    nextStepFollowUp: 'Build natural Sabbath-friendly outdoor friendships and invite members to campfire faith conversations and Sabbath walks.',
    recommendedCountries: ['Singapore', 'Malaysia', 'Thailand', 'Indonesia', 'Philippines'],
    restrictedAccessSafe: true,
    suggestedAudiences: ['A3', 'C', 'D', 'E'],
    deliverablesSnippet:
      'Launch monthly Hike, Camp & Photo Walk Clubs promoted digitally to young adults, with Bridge Friend co-leads and pre-scheduled next-month trail gatherings.',
    outcomesSnippet:
      'Young professionals develop genuine friendships through shared outdoor rhythms and transition into campfire faith dialogues and Sabbath fellowship.',
    integrationSnippet:
      'Young Adult / PCM Ministries and Creators Networks coordinate safety logistics and 48-hour post-walk group photo & next-date invites.',
    budgetItems: [
      '2-Hour "Welcoming Online Guests" Greeter & Bridge Friend Training',
      'Trail / Campsite Permits & First-Aid Safety Kits',
      'Group Breakfast/Picnic Hospitality & Club Guides',
    ],
  },
  {
    id: 'be_26_creative_workshops',
    number: 26,
    title: 'Creative Workshops (Music, Film, Design & Content Creation)',
    theme: 'youth',
    feltNeed: 'Practical digital storytelling, video editing, design, and creative mentorship',
    bridgeFromOnline: 'Offer free weekend creator clinics hosted by Adventist digital media teams for aspiring young creators.',
    nextStepFollowUp: 'Invite participants to co-create community hope/values projects alongside church creators and join weekly studio circles.',
    recommendedCountries: ['Philippines', 'Indonesia', 'Singapore', 'Malaysia', 'Thailand', 'Vietnam'],
    restrictedAccessSafe: true,
    suggestedAudiences: ['A3', 'C', 'D', 'E'],
    deliverablesSnippet:
      'Conduct hands-on Music, Film & Content Creation Clinics pairing online youth applicants with Adventist creators for collaborative hope-themed media projects.',
    outcomesSnippet:
      'Aspiring creators receive mentorship, co-produce uplifting community stories, and remain connected in ongoing studio fellowships.',
    integrationSnippet:
      'SSD/Union Media Centers, Creators Conferences Alumni, and Local Youth Bridge Coordinators pair mentees within 48 hours.',
    budgetItems: [
      '2-Hour "Welcoming Online Guests" Greeter & Bridge Friend Training',
      'Workshop Studio Space, Gear Rental & Mentor Honoraria',
      'Creator Starter Kits & Collaborative Critique Refreshments',
    ],
  },

  // G. Seasonal & Community Celebrations
  {
    id: 'be_27_seasonal_festivals',
    number: 27,
    title: 'Christmas & Easter Community Festivals',
    theme: 'seasonal',
    feltNeed: 'Family celebration, sacred season meaning, music, and neighborhood warmth',
    bridgeFromOnline: 'Capitalize on peak seasonal spiritual interest online with candlelit services, nativity experiences, or Easter hope dramas.',
    nextStepFollowUp: 'Follow up with every guest within 48 hours and invite families to a January/post-Easter New Start small group.',
    recommendedCountries: ['Philippines', 'Timor-Leste', 'Indonesia', 'Singapore', 'Myanmar'],
    restrictedAccessSafe: false,
    suggestedAudiences: ['B', 'C', 'D'],
    deliverablesSnippet:
      'Host Christmas / Easter Community Hope Festivals with dedicated welcome hosts, QR opt-in cards, and pre-scheduled January / post-Easter "New Start" small groups.',
    outcomesSnippet:
      'Seasonal visitors convert momentary holiday interest into January/spring small-group attendance within 30 days.',
    integrationSnippet:
      'Local Churches, Music/Drama Teams, and Local Bridge Coordinators execute 48-hour post-festival contact for all opted-in guests.',
    budgetItems: [
      '2-Hour "Welcoming Online Guests" Greeter & Bridge Friend Training',
      'Festival Staging, Lighting & Community Hospitality',
      'Welcome Packs, Invitation Cards & New Start Group Guides',
    ],
  },
  {
    id: 'be_28_back_to_school',
    number: 28,
    title: 'Back-to-School Kits & Family Day',
    theme: 'seasonal',
    feltNeed: 'Educational supplies relief for families and blessing children at school opening',
    bridgeFromOnline: 'Serve low-income families reached via local outreach and online parent groups with backpacks, health checks, and lunch.',
    nextStepFollowUp: 'Stay connected through weekly tutoring hubs, kids’ clubs, and parent support circles.',
    recommendedCountries: ['Philippines', 'Indonesia', 'Cambodia', 'Timor-Leste', 'Myanmar', 'Laos'],
    restrictedAccessSafe: true,
    suggestedAudiences: ['C', 'D', 'E'],
    deliverablesSnippet:
      'Organize a Back-to-School Kits & Family Day offering school supply packs, basic child health checks, and optional enrollment in ongoing weekly tutoring/kids clubs.',
    outcomesSnippet:
      'Low-income families experience unconditional church care at school opening and stay connected via weekly tutoring and parent fellowships.',
    integrationSnippet:
      'ADRA / ACS, Adventist Schools, and Hope Care Teams provide supplies unconditionally and refer only consenting families within 48 hours.',
    budgetItems: [
      '2-Hour "Welcoming Online Guests" Greeter & Bridge Friend Training',
      'Student Backpacks, Notebooks & School Supply Kits',
      'Family Day Meal Hospitality & Tutoring Signup Desk',
    ],
  },
  {
    id: 'be_29_parent_senior_appreciation',
    number: 29,
    title: "Mother's Day / Father's Day / Seniors' Appreciation",
    theme: 'seasonal',
    feltNeed: 'Honoring parents and elders while relieving loneliness among seniors',
    bridgeFromOnline: 'Invite online followers to nominate or bring a parent/elder for a special lunch, tribute program, and family photo booth.',
    nextStepFollowUp: 'Follow up with home care visits, digital-skills clinics, and invitations to intergenerational Sabbath fellowships.',
    recommendedCountries: ['All 11 SSD Countries'],
    restrictedAccessSafe: true,
    suggestedAudiences: ['B', 'C', 'D', 'E'],
    deliverablesSnippet:
      "Host Mother's/Father's Day & Seniors' Appreciation lunches with printed family portraits, youth-led tributes, and pre-scheduled senior care/home visit dates.",
    outcomesSnippet:
      'Honored elders and their adult children build warm bonds with local church hosts and participate in follow-up home visits or Sabbath lunches.',
    integrationSnippet:
      'Family Ministries, Senior Ministries, and Local Bridge Coordinators match youth/host families for 48-hour follow-up photo delivery and care check-ins.',
    budgetItems: [
      '2-Hour "Welcoming Online Guests" Greeter & Bridge Friend Training',
      'Appreciation Luncheon Catering & Keepsake Flowers/Gifts',
      'Family Portrait Photo Booth & Print Frames',
    ],
  },
];

export interface BridgingThreeTest {
  number: 1 | 2 | 3;
  title: string;
  description: string;
}

export const BRIDGING_THREE_TESTS: BridgingThreeTest[] = [
  {
    number: 1,
    title: 'Answers a felt need',
    description:
      'Addresses real local needs (health, family, stress, skills, or belonging) before asking for spiritual commitment.',
  },
  {
    number: 2,
    title: 'Personal (1:1 Bridge Friend)',
    description:
      'Every online guest is greeted by name and paired with a trained member ("Bridge Friend") who follows up within 48 hours.',
  },
  {
    number: 3,
    title: 'Leads to a next step',
    description:
      'No dead-end event — always pre-schedule a next date (small group, class, home table, Bible study, or Sabbath friendship visit).',
  },
];

export interface CountryBridgingGuidance {
  country: string;
  strongFits: string[];
  sensitivitiesAndLegalNote: string;
  isRestrictedOrSensitive: boolean;
  privacyLaw: string;
}

export const COUNTRY_BRIDGING_GUIDANCE: Record<string, CountryBridgingGuidance> = {
  Philippines: {
    country: 'Philippines',
    strongFits: [
      'Health expos',
      'Fun runs',
      'Concerts',
      'Kids/VBS clubs',
      'Sports leagues',
      'Watch parties',
      'Bible graduations',
    ],
    sensitivitiesAndLegalNote:
      'Large public events work well; coordinate with barangay/LGU leaders and Adventist hospitals/schools.',
    isRestrictedOrSensitive: false,
    privacyLaw: 'Philippines Data Privacy Act (opt-in consent required before sharing contact info)',
  },
  Indonesia: {
    country: 'Indonesia',
    strongFits: [
      'Health expos',
      'Cooking classes',
      'Breathe Free',
      'English clubs',
      'Disaster prep',
      'Campus groups',
    ],
    sensitivitiesAndLegalNote:
      'Respect religious harmony regulations; frame public events around health, family, education, and community benefit.',
    isRestrictedOrSensitive: true,
    privacyLaw: 'Indonesia Personal Data Protection (PDP) Law (explicit consent & secure storage)',
  },
  'Timor-Leste': {
    country: 'Timor-Leste',
    strongFits: [
      'Youth sports',
      'English/computer clubs',
      'Health & hygiene workshops',
      'Community service',
    ],
    sensitivitiesAndLegalNote:
      'High youth population; build warm trust with local suco/aldeia leaders and Christian families.',
    isRestrictedOrSensitive: false,
    privacyLaw: 'Explicit opt-in guest consent & need-to-know local coordinator access',
  },
  Malaysia: {
    country: 'Malaysia',
    strongFits: [
      'Health & wellness',
      'Family seminars',
      'Cooking classes',
      'Tutoring',
      'Festive open houses',
    ],
    sensitivitiesAndLegalNote:
      'Observe legal limits on religious propagation; keep public events focused on health, family, and community care.',
    isRestrictedOrSensitive: true,
    privacyLaw: 'Malaysia PDPA (strict opt-in consent before sharing personal details)',
  },
  Brunei: {
    country: 'Brunei',
    strongFits: [
      'Very discreet health, family, and friendship gatherings within existing networks',
    ],
    sensitivitiesAndLegalNote:
      'Strict restrictions on public religious promotion and non-Muslim outreach; seek Union counsel before any public event and never publish guest names, photos, or locations.',
    isRestrictedOrSensitive: true,
    privacyLaw: 'Restricted-access privacy protocol (encrypted need-to-know lists; zero public photos/names)',
  },
  Singapore: {
    country: 'Singapore',
    strongFits: [
      'Wellness runs',
      'CHIP / mental-health',
      'Young professional cafés',
      'Volunteer days',
    ],
    sensitivitiesAndLegalNote:
      'Observe Maintenance of Religious Harmony Act norms; high digital readiness favors quality hybrid online-to-café follow-up.',
    isRestrictedOrSensitive: false,
    privacyLaw: 'Singapore PDPA (explicit opt-in consent & secure digital CRM handling)',
  },
  Vietnam: {
    country: 'Vietnam',
    strongFits: [
      'English clubs',
      'Health & cooking',
      'Parenting workshops',
      'Small home groups',
    ],
    sensitivitiesAndLegalNote:
      'Follow local registration rules for gatherings; build low-profile, relationship-based small groups and never publish sensitive guest data.',
    isRestrictedOrSensitive: true,
    privacyLaw: 'Restricted-access privacy protocol & opt-in consent (zero public contact photos/locations)',
  },
  Myanmar: {
    country: 'Myanmar',
    strongFits: [
      'Health/education care',
      'English clubs',
      'ADRA humanitarian support',
      'Small fellowship groups',
    ],
    sensitivitiesAndLegalNote:
      'Prioritize safety and security in all areas; favor small, compassionate community gatherings and avoid large unsafe assemblies.',
    isRestrictedOrSensitive: true,
    privacyLaw: 'Safety-first privacy protocol (protect participant identities & locations)',
  },
  Cambodia: {
    country: 'Cambodia',
    strongFits: [
      'Health & dental clinics',
      'English/computer skills',
      'Kids clubs',
      'ADRA community projects',
    ],
    sensitivitiesAndLegalNote:
      'Respect Buddhist and pagoda-centered community life; coordinate with village/commune leaders and avoid any appearance of material inducement.',
    isRestrictedOrSensitive: false,
    privacyLaw: 'Explicit voluntary consent (unconditional care; never tie aid to religious attendance)',
  },
  Thailand: {
    country: 'Thailand',
    strongFits: [
      'Wellness runs',
      'Health expos',
      'Cooking',
      'English camps',
      'Family seminars',
      'Campus/young-pro cafés',
    ],
    sensitivitiesAndLegalNote:
      'Show deep respect for Thai Buddhism and culture; partner closely with Adventist hospitals and schools.',
    isRestrictedOrSensitive: false,
    privacyLaw: 'Thailand PDPA (explicit opt-in consent & purpose-limited local routing)',
  },
  Laos: {
    country: 'Laos',
    strongFits: [
      'Health education',
      'English & life skills training',
      'Small home friendship groups',
    ],
    sensitivitiesAndLegalNote:
      'Religious activities are closely regulated; keep events small and low-profile, register as required, and seek Union counsel.',
    isRestrictedOrSensitive: true,
    privacyLaw: 'Restricted-access privacy protocol (small home gatherings; zero public guest photos/names)',
  },
};

export const UNION_TO_COUNTRIES: Record<string, string[]> = {
  'East Central Philippine Union Conference': ['Philippines'],
  'Northern Luzon Philippine Union Mission': ['Philippines'],
  'Southeastern Philippine Union Mission': ['Philippines'],
  'Southern Luzon Philippine Union Mission': ['Philippines'],
  'Southwestern Philippine Union Conference': ['Philippines'],
  'West Central Philippine Union Mission': ['Philippines'],
  'Central Indonesia Union Mission': ['Indonesia'],
  'East Indonesia Union Conference': ['Indonesia'],
  'West Indonesia Union Mission': ['Indonesia'],
  'Timor-Leste Mission': ['Timor-Leste'],
  'Malaysia Union Mission': ['Malaysia'],
  'Singapore Conference': ['Singapore'],
  'Myanmar Union Mission': ['Myanmar'],
  'Southeastern Asia Union Mission': ['Thailand', 'Cambodia', 'Vietnam', 'Laos', 'Brunei'],
};

export interface HarvestCalendarPeriod {
  months: string;
  phase: string;
  bridgingFocus: string;
}

export const BRIDGING_HARVEST_CALENDAR: HarvestCalendarPeriod[] = [
  {
    months: 'Jan – Mar',
    phase: 'Sow',
    bridgingFocus: 'Felt-need & wellness events (Fun Runs, Health Expos, Parenting, Financial Freedom)',
  },
  {
    months: 'Apr – Jul',
    phase: 'Cultivate',
    bridgingFocus: 'Small-group continuity (English Clubs, Cooking, Faith Cafés, Watch Parties, Youth Sports)',
  },
  {
    months: 'August',
    phase: 'Prepare',
    bridgingFocus: 'Train Bridge Friends (2-hr Welcoming training), Sabbath Open Houses, Prayer Visits',
  },
  {
    months: 'September',
    phase: 'Reap (Harvest Month)',
    bridgingFocus: 'SSD Public Evangelism, Proclamation & Bible Course Graduations (home groups in sensitive areas)',
  },
  {
    months: 'Oct – Nov',
    phase: 'Preserve',
    bridgingFocus: 'New-believer small-group integration, mentoring, and 3- & 6-month belonging check-ins',
  },
  {
    months: 'December',
    phase: 'Celebrate',
    bridgingFocus: 'Christmas & year-end Community Festivals inviting new contacts into January New Start groups',
  },
];

export interface BridgingSuccessIndicator {
  number: number;
  name: string;
  question: string;
}

export const BRIDGING_SUCCESS_INDICATORS: BridgingSuccessIndicator[] = [
  { number: 1, name: 'Reach', question: 'Online contacts invited to a local bridging event' },
  { number: 2, name: 'Response', question: 'Invited contacts who actually attend (%)' },
  { number: 3, name: 'Connection', question: 'Guests paired with a Bridge Friend & contacted within 48h (%)' },
  { number: 4, name: 'Continuation', question: 'Guests attending a second activity or small group within 30 days (%)' },
  { number: 5, name: 'Spiritual Interest', question: 'Guests requesting prayer, Bible studies, or pastoral visits' },
  { number: 6, name: 'Belonging', question: 'Guests still attending Sabbath worship or small groups at 3 & 6 months' },
  { number: 7, name: 'Fruit', question: 'Baptisms & professions of faith linked to bridging pathways' },
  { number: 8, name: 'Member Involvement', question: 'Church members trained and serving as active Bridge Friends' },
];

export interface UnionBridgingGuidanceResult {
  canonicalUnion: string;
  countries: string[];
  guidanceList: CountryBridgingGuidance[];
  isRestrictedOrSensitive: boolean;
  privacyLawsSummary: string;
}

export function getBridgingGuidanceForUnion(union?: string): UnionBridgingGuidanceResult {
  const canonicalUnion = getCanonicalUnion(union);
  const countries =
    (canonicalUnion && UNION_TO_COUNTRIES[canonicalUnion]) ||
    Object.keys(COUNTRY_BRIDGING_GUIDANCE);

  const guidanceList = countries
    .map((c) => COUNTRY_BRIDGING_GUIDANCE[c])
    .filter(Boolean);

  const isRestrictedOrSensitive = guidanceList.some((g) => g.isRestrictedOrSensitive);
  const privacyLawsSummary = Array.from(new Set(guidanceList.map((g) => g.privacyLaw))).join(' · ');

  return {
    canonicalUnion,
    countries,
    guidanceList,
    isRestrictedOrSensitive,
    privacyLawsSummary,
  };
}

export interface BridgingProposalContext {
  isBridgingContext: boolean;
  isBridgingHostProposal: boolean;
  isPillar1BridgingEnabling: boolean;
  supportsBridgingDownstream: boolean;
  shouldCoachGreeterTraining: boolean;
  hasExplicitBridgingKeywords: boolean;
  isConnectOrHarvestTrack: boolean;
  isCommunityServiceTrack: boolean;
  hasFollowUpAnd48h: boolean;
  hasBridgeFriendOrCoordinator: boolean;
  hasPreScheduledNextStep: boolean;
  hasGreeterTraining: boolean;
  hasPrivacyOptInConsent: boolean;
  usesOnlineLeadHandoff: boolean;
  hasPublicExposureRiskText: boolean;
  mentionsVanityHeadcountOnly: boolean;
  mentionsHealthEvent: boolean;
}

export function detectBridgingProposalContext(proposal: Proposal): BridgingProposalContext {
  const canonicalKpi = getCanonicalKpiType(proposal.kpiType);
  const pillarKey = getProposalPillarKey(proposal);
  const canonicalObjective = getCanonicalDivisionProject(proposal.divisionProject);

  const isToolMakerMediaObjective =
    canonicalObjective === 'Short-Form Content' ||
    canonicalObjective === 'Global Contextualized Media Production' ||
    canonicalObjective === 'Proclamation Kits & Contextualized Evangelistic Materials';

  const allText = [
    proposal.title,
    proposal.overview,
    proposal.goal,
    proposal.outcomes,
    proposal.deliverables,
    proposal.pointsOfIntegration,
    proposal.kpiDescription,
    proposal.kpiRationale,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // Only inspect Title, Goal, and Deliverables (not Section 8 Integration or background Overview)
  // when deciding whether THIS proposal itself hosts an in-person bridging event.
  const hostPlanText = [
    proposal.title,
    proposal.goal,
    proposal.deliverables,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const deliverablesAndGoals = [
    proposal.title,
    proposal.overview,
    proposal.goal,
    proposal.deliverables,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const downstreamText = [
    proposal.outcomes,
    proposal.deliverables,
    proposal.pointsOfIntegration,
    proposal.kpiDescription,
    proposal.kpiRationale,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const bridgingKeywordRegex =
    /\b(bridging\s+event\w*|bridge\s+friend\w*|bridge\s+coordinator|community\s+event\w*|health\s+expo\w*|fun\s+run|walk\s+for\s+life|cooking\s+class\w*|breathe\s+free|quit\s+smoking|english\s+club|language\s+caf[eé]|faith\s+caf[eé]|coffee\s*(?:&|and)\s*questions|watch\s+party|viewers['’]?\s+rally|sabbath\s+open\s+house|friendship\s+lunch|prayer\s+walk|concert\w*\s+of\s+hope|holiday\s+club|vbs|pathfinder\s+open\s+day|volunteer\s+day\w*|blood\s+donation|disaster\s+preparedness|community\s+meal|financial\s+freedom|digital\s+skills|tutoring\s+cent(?:er|re)|sports\s+league\w*|photo\s+walk|in-person\s+event\w*|community\s+festival\w*)\b/i;

  const hasExplicitBridgingKeywords = bridgingKeywordRegex.test(allText);

  const hasExplicitHostBridgingInPlan =
    bridgingKeywordRegex.test(hostPlanText) ||
    (/\b(all\s*things\s*new|allthingsnew|hopestartshere)\b/i.test(hostPlanText) &&
      /\b(event\w*|gathering\w*|seminar\w*|workshop\w*|caf[eé]|club|camp|expo|dinner|lunch)\b/i.test(
        hostPlanText
      ));

  const isConnectOrHarvestTrack =
    canonicalKpi === 'connection_next_steps' || pillarKey === 'proclamation';

  const isCommunityServiceTrack =
    /\b(medical\s+mission\w*|health\s+clinic\w*|health\s+expo\w*|community\s+service|adra\b|feeding\s+program|disaster\s+prep|blood\s+donation|literacy|tutoring)\b/i.test(
      deliverablesAndGoals
    );

  // Pillar 2 Tool-Makers (Short-Form Content, Media Production, Proclamation Kits) funnel viewers to
  // downstream events rather than hosting in-person church bridging gatherings themselves unless KPI 3
  // or Community Service is explicitly active.
  const isPureToolMakerMedia =
    pillarKey === 'bold_initiatives' &&
    isToolMakerMediaObjective &&
    canonicalKpi !== 'connection_next_steps' &&
    !isCommunityServiceTrack;

  const isBridgingHostProposal =
    !isPureToolMakerMedia &&
    pillarKey !== 'inspiration' &&
    (hasExplicitHostBridgingInPlan ||
      canonicalKpi === 'connection_next_steps' ||
      isCommunityServiceTrack);

  // Pillar 1 (Training & Enabling) is the primary home for equipping church greeters and Bridge Friends
  const isPillar1BridgingEnabling =
    pillarKey === 'inspiration' &&
    (hasExplicitBridgingKeywords ||
      /\b(greeter\w*|welcom\w+\s+(?:online|first-time)\s+guests|seeker[\s-]ready|church\s+readiness|host\s+team\w*|hope\s+care\s+team\w*)\b/i.test(
        allText
      ));

  const isBridgingContext = isBridgingHostProposal || isPillar1BridgingEnabling;

  const shouldCoachGreeterTraining =
    isPillar1BridgingEnabling || (isBridgingHostProposal && pillarKey !== 'bold_initiatives');

  const hasFollowUpAnd48h =
    /\b(48[\s-]*h(?:our|ours|r|rs)?|within\s+two\s+days|two\s+days)\b/i.test(downstreamText) &&
    /\b(follow[\s-]*up|contact\w*|respond\w*|call|visit|message)\b/i.test(downstreamText);

  const hasBridgeFriendOrCoordinator =
    /\b(bridge\s+friend\w*|bridge\s+coordinator|one\s+registrant|1:1\s+(?:friend|buddy|host|mentor)|paired\s+(?:with|by)|buddy\s+system|host\s+famil\w*|care\s+partner\w*|interest\s+coordinator\w*)\b/i.test(
      downstreamText
    );

  const hasPreScheduledNextStep =
    /\b(pre[\s-]*scheduled|next\s+date|already\s+scheduled|second\s+activit\w*|within\s+30\s+days|small\s+group\w*|home\s+group\w*|weekly\s+(?:class|club|circle|group|fellowship|study)|discovery\s+group|4[\s-]*week|6[\s-]*week|8[\s-]*week|sabbath\s+open\s+house|care\s+group\w*)\b/i.test(
      downstreamText
    );

  const hasGreeterTraining =
    /\b(2[\s-]*hour|two[\s-]*hour|welcoming\s+online\s+guests|greeter\s+training|host\s+training|train\s+(?:greeters|hosts|members|volunteers|bridge\s+friends)\s+before|trained\s+(?:greeters|welcomers|hosts|bridge\s+friends))\b/i.test(
      allText
    );

  const hasPrivacyOptInConsent =
    /\b(opt[\s-]*in|voluntary\s+consent|informed\s+consent|explicit\s+consent|pdpa|data\s+privacy\s+act|pdp\s+law|privacy\s+law|need[\s-]*to[\s-]*know|consent\s+checkbox|with\s+consent)\b/i.test(
      downstreamText
    );

  const usesOnlineLeadHandoff =
    /\b(allthingsnew|all\s*things\s*new|hopestartshere|online\s+(?:lead|contact|registrant|viewer|follower|seeker|inquiry|signup)|social\s+media\s+(?:ad|lead)|crm|referral)\b/i.test(
      allText
    );

  const supportsBridgingDownstream =
    !isBridgingContext && (hasExplicitBridgingKeywords || usesOnlineLeadHandoff);

  const hasPublicExposureRiskText =
    /\b(publish\s+(?:names|photos|locations)|public\s+(?:crusade|rally|concert|march|street\s+preach)|livestream\s+(?:guests|attendees|participants)|post\s+(?:photos|names)\s+of\s+(?:guests|seekers|converts)|unblurred)\b/i.test(
      allText
    );

  const kpiAndOutcomesLower = `${proposal.kpiNumber || ''} ${proposal.kpiDescription || ''} ${
    proposal.outcomes || ''
  }`.toLowerCase();
  const mentionsVanityHeadcountOnly =
    canonicalKpi === 'connection_next_steps' &&
    /\b(attend\w*|participants|visitors|headcount|crowd|people\s+came|guests)\b/i.test(
      kpiAndOutcomesLower
    ) &&
    !/\b(48[\s-]*h|bridge\s+friend|30[\s-]*day|second\s+activity|continuation|small\s+group|follow[\s-]*up|3\s*(?:&|and)\s*6\s*month|bible\s+stud\w*)\b/i.test(
      kpiAndOutcomesLower
    );

  const mentionsHealthEvent =
    /\b(health\s+expo|health\s+check|screening|chip|celebrations|breathe\s+free|cooking\s+class|blood\s+donation|mental\s+wellness|fun\s+run)\b/i.test(
      allText
    );

  return {
    isBridgingContext,
    isBridgingHostProposal,
    isPillar1BridgingEnabling,
    supportsBridgingDownstream,
    shouldCoachGreeterTraining,
    hasExplicitBridgingKeywords,
    isConnectOrHarvestTrack,
    isCommunityServiceTrack,
    hasFollowUpAnd48h,
    hasBridgeFriendOrCoordinator,
    hasPreScheduledNextStep,
    hasGreeterTraining,
    hasPrivacyOptInConsent,
    usesOnlineLeadHandoff,
    hasPublicExposureRiskText,
    mentionsVanityHeadcountOnly,
    mentionsHealthEvent,
  };
}

export interface PrioritizedBridgingEvent extends BridgingEventIdea {
  isCountryStrongFit: boolean;
  matchingCountries: string[];
}

export function getPrioritizedBridgingEvents(
  union?: string,
  themeFilter: BridgingThemeId | 'all' = 'all',
  searchQuery = ''
): PrioritizedBridgingEvent[] {
  const { countries, canonicalUnion } = getBridgingGuidanceForUnion(union);
  const hasSpecificUnion = Boolean(canonicalUnion);
  const q = searchQuery.trim().toLowerCase();

  const mapped: PrioritizedBridgingEvent[] = BRIDGING_EVENT_IDEAS.filter((ev) => {
    if (themeFilter !== 'all' && ev.theme !== themeFilter) return false;
    if (!q) return true;
    const haystack = `${ev.title} ${ev.feltNeed} ${ev.bridgeFromOnline} ${ev.nextStepFollowUp} ${ev.recommendedCountries.join(' ')}`.toLowerCase();
    return haystack.includes(q);
  }).map((ev) => {
    const isAllCountries = ev.recommendedCountries.includes('All 11 SSD Countries');
    const matchingCountries = isAllCountries
      ? countries
      : ev.recommendedCountries.filter((c) => countries.includes(c));
    const isCountryStrongFit = hasSpecificUnion && (isAllCountries || matchingCountries.length > 0);
    return {
      ...ev,
      isCountryStrongFit,
      matchingCountries,
    };
  });

  if (!hasSpecificUnion) return mapped;

  return mapped.sort((a, b) => {
    if (a.isCountryStrongFit && !b.isCountryStrongFit) return -1;
    if (!a.isCountryStrongFit && b.isCountryStrongFit) return 1;
    return a.number - b.number;
  });
}
