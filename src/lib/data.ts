// Shared mock data - imported by list pages and detail pages

export type WorkerType = "individual" | "team" | "company";

export const toSlug = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export interface Review {
  author: string;
  rating: number;
  text: string;
  date: string;
}

export interface WorkerData {
  id: number;
  slug: string;
  name: string;
  type: WorkerType;
  teamSize?: number;
  category: string;
  categories: string[];
  location: string;
  rating: number;
  jobs: number;
  available: boolean;
  ratePerDay: number;
  bio: string;
  languages: string[];
  verified: boolean;
  yearsExp: number;
  reviews: Review[];
}

export interface JobData {
  id: number;
  title: string;
  category: string;
  location: string;
  amount: number;
  period: string;
  posted: number;
  slots: number;
  urgent: boolean;
  description: string;
  requirements: string[];
  employerName: string;
  employerJobs: number;
}

export const WORKERS: WorkerData[] = [
  {
    id: 1, slug: "jean-pierre-m",
    name: "Jean Pierre M.", type: "individual",
    category: "Waiters", categories: ["Waiters", "Event Staff"],
    location: "Kacyiru", rating: 4.9, jobs: 42, available: true,
    ratePerDay: 8000, yearsExp: 4, verified: true,
    languages: ["Kinyarwanda", "English", "French"],
    bio: "Professional waiter with 4 years of experience at high-end hotels and corporate events in Rwanda. Trained in formal table service, wine presentation, and large-scale event coordination.",
    reviews: [
      { author: "Amani Events", rating: 5, text: "Jean Pierre was exceptional at our gala dinner. Professional, fast, and guests loved him.", date: "2 weeks ago" },
      { author: "Sarah M.", rating: 5, text: "Showed up on time, was well-dressed and very courteous. Will hire again.", date: "1 month ago" },
      { author: "Rwanda Conf. Centre", rating: 4, text: "Great service during our 3-day conference. Slight delay on day 2 but overall excellent.", date: "2 months ago" },
    ],
  },
  {
    id: 2, slug: "diane-u",
    name: "Diane U.", type: "individual",
    category: "Cleaners", categories: ["Cleaners", "Domestic Help"],
    location: "Remera", rating: 4.8, jobs: 67, available: true,
    ratePerDay: 6500, yearsExp: 5, verified: true,
    languages: ["Kinyarwanda", "English"],
    bio: "Detail-oriented cleaner with 5 years specialising in post-event, office, and residential deep cleans. Brings her own eco-friendly products and always leaves the space spotless.",
    reviews: [
      { author: "Green Office Ltd", rating: 5, text: "Our office sparkles every time Diane comes. Reliable and thorough.", date: "1 week ago" },
      { author: "Claudette R.", rating: 5, text: "Did a post-party deep clean at my home - absolutely flawless job.", date: "3 weeks ago" },
      { author: "Remera Suites", rating: 5, text: "We use Diane regularly for our guest apartments. Never had a complaint.", date: "1 month ago" },
    ],
  },
  {
    id: 3, slug: "eric-n",
    name: "Eric N.", type: "individual",
    category: "Drivers", categories: ["Drivers"],
    location: "Gisozi", rating: 5.0, jobs: 28, available: true,
    ratePerDay: 12000, yearsExp: 6, verified: true,
    languages: ["Kinyarwanda", "English", "Swahili"],
    bio: "Experienced and highly punctual driver with 6 years driving executives, tourists, and event guests around Rwanda and upcountry. Clean driving record, familiar with all Rwanda districts.",
    reviews: [
      { author: "Capital Group", rating: 5, text: "Eric drove our CEO for an entire week - always on time, professional, discreet.", date: "5 days ago" },
      { author: "Visit Rwanda", rating: 5, text: "Best tour driver we've used. Guests were very happy.", date: "2 weeks ago" },
      { author: "Mugabo T.", rating: 5, text: "Picked me up from the airport at 4am without any issues. Highly recommend.", date: "1 month ago" },
    ],
  },
  {
    id: 4, slug: "alice-k",
    name: "Alice K.", type: "individual",
    category: "Security", categories: ["Security"],
    location: "Kimihurura", rating: 4.7, jobs: 51, available: false,
    ratePerDay: 10000, yearsExp: 7, verified: true,
    languages: ["Kinyarwanda", "English"],
    bio: "Former law enforcement officer turned private security professional. Alice specialises in venue security, VIP escort, and access control. Strong, alert, and trained in first aid.",
    reviews: [
      { author: "Hotel Des Mille Collines", rating: 5, text: "Alice managed security for our conference - zero incidents.", date: "3 weeks ago" },
      { author: "Amani Events", rating: 4, text: "Good professional. Would use again for corporate events.", date: "2 months ago" },
      { author: "Rwanda Arena", rating: 5, text: "Very reliable for our concert nights. Firm but respectful.", date: "3 months ago" },
    ],
  },
  {
    id: 5, slug: "patrick-h",
    name: "Patrick H.", type: "individual",
    category: "Electricians", categories: ["Electricians", "IT Support"],
    location: "Kicukiro", rating: 4.9, jobs: 33, available: true,
    ratePerDay: 15000, yearsExp: 8, verified: true,
    languages: ["Kinyarwanda", "English", "French"],
    bio: "Certified electrician with 8 years handling residential, commercial, and industrial wiring projects. Licensed by REMA. Clean work, compliant with Rwanda building codes.",
    reviews: [
      { author: "Nyarugenge Housing", rating: 5, text: "Patrick wired our entire 12-unit apartment block. Perfect work, on schedule.", date: "1 month ago" },
      { author: "TechHub Rwanda", rating: 5, text: "Sorted our server room power issues quickly. Knew exactly what to do.", date: "6 weeks ago" },
      { author: "Jean-Claude N.", rating: 5, text: "Fixed a wiring issue that three other electricians couldn't. Legend.", date: "2 months ago" },
    ],
  },
  {
    id: 6, slug: "grace-i",
    name: "Grace I.", type: "individual",
    category: "Cleaners", categories: ["Cleaners", "Domestic Help"],
    location: "Nyamirambo", rating: 4.8, jobs: 89, available: true,
    ratePerDay: 6500, yearsExp: 6, verified: true,
    languages: ["Kinyarwanda", "Swahili"],
    bio: "Grace is one of our top-rated cleaners with 89 completed jobs. She specialises in residential cleaning, laundry, and household organisation. Trusted by families across Rwanda for over 6 years.",
    reviews: [
      { author: "Uwimana Family", rating: 5, text: "Grace has been cleaning our home weekly for 2 years. Absolutely dependable.", date: "2 days ago" },
      { author: "Airbnb Host – Nyamirambo", rating: 5, text: "Guests always mention how clean the apartment is. Grace is the reason.", date: "2 weeks ago" },
      { author: "Fatuma A.", rating: 5, text: "Organised my entire home after we moved in. Amazing job.", date: "1 month ago" },
    ],
  },
  {
    id: 7, slug: "samuel-b",
    name: "Samuel B.", type: "individual",
    category: "Plumbers", categories: ["Plumbers", "Construction"],
    location: "Gikondo", rating: 4.6, jobs: 19, available: false,
    ratePerDay: 12000, yearsExp: 4, verified: true,
    languages: ["Kinyarwanda"],
    bio: "Reliable plumber covering pipe installation, leak repairs, bathroom fitting, and drainage systems. Familiar with both old and new construction in Rwanda.",
    reviews: [
      { author: "Rwanda Heights", rating: 5, text: "Installed plumbing for 4 bathrooms quickly and cleanly.", date: "3 weeks ago" },
      { author: "Nshuti P.", rating: 4, text: "Fixed a burst pipe on short notice. Prices are fair.", date: "2 months ago" },
      { author: "Mireille K.", rating: 5, text: "No more leaks! Samuel found the problem in minutes.", date: "3 months ago" },
    ],
  },
  {
    id: 8, slug: "marie-c",
    name: "Marie C.", type: "individual",
    category: "Domestic Help", categories: ["Domestic Help", "Cleaners", "Nanny"],
    location: "Kacyiru", rating: 4.9, jobs: 55, available: true,
    ratePerDay: 7000, yearsExp: 9, verified: true,
    languages: ["Kinyarwanda", "French"],
    bio: "Experienced housekeeper and domestic helper with 9 years in private homes. Marie handles cooking, cleaning, childcare, and household management with warmth and professionalism.",
    reviews: [
      { author: "Habimana Family", rating: 5, text: "Marie is like family. Trustworthy, caring, and incredibly hardworking.", date: "1 week ago" },
      { author: "Expat Family – Kacyiru", rating: 5, text: "Marie made our transition to Rwanda so smooth. Incredible with our kids.", date: "1 month ago" },
      { author: "Ingabire A.", rating: 5, text: "Professional and discreet. Our home runs perfectly when Marie is here.", date: "2 months ago" },
    ],
  },
  {
    id: 9, slug: "olivier-t",
    name: "Olivier T.", type: "individual",
    category: "Construction", categories: ["Construction", "Painters", "Plumbers"],
    location: "Kanombe", rating: 4.5, jobs: 37, available: true,
    ratePerDay: 8500, yearsExp: 10, verified: true,
    languages: ["Kinyarwanda", "English"],
    bio: "Seasoned construction labourer with 10 years on residential and commercial sites. Skilled in masonry, plastering, painting, and general building work. Available for day jobs or multi-week projects.",
    reviews: [
      { author: "BuildRwanda Ltd", rating: 5, text: "Olivier is a great team player and knows construction inside out.", date: "3 weeks ago" },
      { author: "Karangwa N.", rating: 4, text: "Solid work on our extension. Finished ahead of schedule.", date: "2 months ago" },
      { author: "Sunrise Properties", rating: 4, text: "Good worker, occasionally needs direction on complex tasks.", date: "4 months ago" },
    ],
  },
  {
    id: 10, slug: "claudine-m",
    name: "Claudine M.", type: "individual",
    category: "Photographers", categories: ["Photographers", "Videographers"],
    location: "Kimihurura", rating: 5.0, jobs: 14, available: true,
    ratePerDay: 25000, yearsExp: 3, verified: true,
    languages: ["Kinyarwanda", "English", "French"],
    bio: "Creative photographer and videographer specialising in events, portraits, and corporate shoots. Claudine delivers edited photos within 48 hours and brings a modern, clean aesthetic to every project.",
    reviews: [
      { author: "Rwanda Fashion Week", rating: 5, text: "Our best photos in years. Claudine has an incredible eye.", date: "1 week ago" },
      { author: "Uwera Wedding", rating: 5, text: "Our wedding photos are stunning. We cried happy tears looking through them.", date: "3 weeks ago" },
      { author: "MTN Rwanda", rating: 5, text: "Professional, fast turnaround, and the corporate shots were perfect.", date: "2 months ago" },
    ],
  },
  {
    id: 11, slug: "bosco-r",
    name: "Bosco R.", type: "individual",
    category: "Movers", categories: ["Movers", "Loaders"],
    location: "Remera", rating: 4.7, jobs: 23, available: true,
    ratePerDay: 9000, yearsExp: 3, verified: true,
    languages: ["Kinyarwanda", "English"],
    bio: "Strong, careful, and punctual mover available for residential and commercial relocations. Bosco handles furniture disassembly, packing, loading, and placement at the new location.",
    reviews: [
      { author: "Kagabo R.", rating: 5, text: "Moved our entire 3-bedroom in one day. Nothing was damaged.", date: "1 month ago" },
      { author: "Keza Furnitures", rating: 5, text: "Bosco helps with all our deliveries. Fast and reliable.", date: "2 months ago" },
      { author: "Niyonzima A.", rating: 4, text: "Good work, brought a friend which helped. Would hire again.", date: "3 months ago" },
    ],
  },
  {
    id: 12, slug: "yvonne-n",
    name: "Yvonne N.", type: "individual",
    category: "Gardeners", categories: ["Gardeners", "Farm Workers"],
    location: "Gisozi", rating: 4.8, jobs: 41, available: false,
    ratePerDay: 5500, yearsExp: 5, verified: true,
    languages: ["Kinyarwanda"],
    bio: "Passionate gardener skilled in lawn mowing, hedge trimming, planting, weeding, and landscape maintenance. Yvonne keeps your garden looking its best all year round.",
    reviews: [
      { author: "Residence La Palme", rating: 5, text: "Our gardens have never looked better since Yvonne joined our team.", date: "2 weeks ago" },
      { author: "Cyiza P.", rating: 5, text: "Transformed our overgrown yard into a beautiful garden. Impressive.", date: "1 month ago" },
      { author: "Rwanda Heights HOA", rating: 4, text: "Consistent and knowledgeable. Knows exactly what each plant needs.", date: "2 months ago" },
    ],
  },
  {
    id: 13, slug: "kigali-clean-team",
    name: "Rwanda Clean Team", type: "team", teamSize: 5,
    category: "Cleaners", categories: ["Cleaners", "Domestic Help", "Event Staff"],
    location: "Nyamirambo", rating: 4.9, jobs: 120, available: true,
    ratePerDay: 30000, yearsExp: 4, verified: true,
    languages: ["Kinyarwanda", "English", "French"],
    bio: "A dedicated team of 5 professional cleaners available for large events, offices, and residential complexes. We bring all equipment and supplies, and can handle venues up to 500 guests. Post-event same-day turnaround guaranteed.",
    reviews: [
      { author: "Serena Hotel", rating: 5, text: "Cleaned a 400-person gala venue overnight. Immaculate by 6am.", date: "3 weeks ago" },
      { author: "BK Arena", rating: 5, text: "Our go-to team for post-concert cleanup. Always on time.", date: "1 month ago" },
      { author: "CHIC Conference", rating: 5, text: "Exceptional work for our 3-day conference. Highly professional team.", date: "2 months ago" },
    ],
  },
  {
    id: 14, slug: "securepro-rwanda",
    name: "SecurePro Rwanda", type: "company", teamSize: 20,
    category: "Security", categories: ["Security", "Event Staff"],
    location: "Rwanda-wide", rating: 4.8, jobs: 250, available: true,
    ratePerDay: 15000, yearsExp: 8, verified: true,
    languages: ["Kinyarwanda", "English", "French", "Swahili"],
    bio: "Registered security company with 20 trained and licensed officers. SecurePro serves corporate offices, embassies, hotels, and large events across Rwanda. All personnel hold valid security licences from NPPA.",
    reviews: [
      { author: "US Embassy Rwanda", rating: 5, text: "Professional, disciplined, and reliable. We've used SecurePro for 3 years.", date: "1 month ago" },
      { author: "Rwanda Marriott", rating: 5, text: "Excellent security provider. Our guests feel safe at all times.", date: "6 weeks ago" },
      { author: "RDB Events", rating: 4, text: "Very good service for our national investment summit.", date: "3 months ago" },
    ],
  },
  {
    id: 15, slug: "elite-movers-ltd",
    name: "Elite Movers Ltd", type: "company", teamSize: 12,
    category: "Movers", categories: ["Movers", "Loaders", "Construction"],
    location: "Kicukiro", rating: 4.7, jobs: 180, available: true,
    ratePerDay: 50000, yearsExp: 6, verified: true,
    languages: ["Kinyarwanda", "English"],
    bio: "Registered moving company with a fleet of 3 trucks and a team of 12. Elite Movers handles residential moves, office relocations, and furniture delivery across Rwanda. Insurance-backed, no extra charges for stairs.",
    reviews: [
      { author: "RSSB Offices", rating: 5, text: "Relocated our entire office of 50 people in one weekend. Flawless.", date: "2 weeks ago" },
      { author: "Mukamana C.", rating: 5, text: "Moved from Nyamirambo to Gasabo - nothing scratched, nothing lost.", date: "1 month ago" },
      { author: "Rwanda Heights Devs", rating: 4, text: "Good company, slightly pricey but worth it for the reliability.", date: "2 months ago" },
    ],
  },
];

export const JOBS: JobData[] = [
  {
    id: 1, title: "Event Waiter Needed", category: "Waiters",
    location: "Kacyiru", amount: 8000, period: "day", posted: 0, slots: 3, urgent: true,
    description: "We are hosting a corporate dinner for 80 guests at our Kacyiru offices on Friday evening. We need 3 experienced waiters for 6 hours of service - welcome drinks, 3-course dinner, and post-dinner cocktails.",
    requirements: ["Formal attire (black and white)", "Minimum 1 year serving experience", "Fluent in English or French", "Available from 5pm to 11pm"],
    employerName: "Capital Group Rwanda", employerJobs: 14,
  },
  {
    id: 2, title: "Office Cleaner", category: "Cleaners",
    location: "Nyamirambo", amount: 6500, period: "day", posted: 1, slots: 1, urgent: false,
    description: "Looking for a reliable cleaner to handle our open-plan office of 20 workstations, 2 meeting rooms, kitchen, and 3 washrooms. Hours are 7am–10am, Monday to Friday.",
    requirements: ["Previous office cleaning experience", "Own cleaning supplies preferred (extra pay)", "Early morning availability", "Trustworthy references"],
    employerName: "Nyamirambo Digital Hub", employerJobs: 6,
  },
  {
    id: 3, title: "Night Security Guard", category: "Security",
    location: "Kimihurura", amount: 10000, period: "night", posted: 0, slots: 2, urgent: true,
    description: "Residential compound in Kimihurura needs 2 night security guards starting immediately. The compound has 8 houses with a shared entrance gate. 12-hour shifts (7pm–7am).",
    requirements: ["Valid NPPA security licence", "Physically fit", "No criminal record", "References from previous employer"],
    employerName: "Kimihurura Residence Association", employerJobs: 22,
  },
  {
    id: 4, title: "Personal Driver", category: "Drivers",
    location: "Remera", amount: 12000, period: "day", posted: 2, slots: 1, urgent: false,
    description: "Executive needs a personal driver for daily trips around Rwanda plus occasional upcountry missions. Must be available from 7am to 7pm, Monday to Saturday.",
    requirements: ["Valid Rwandan driving licence (min. Class B)", "Clean driving record", "Presentable appearance", "Punctuality is essential", "Discreet and professional"],
    employerName: "Private Client", employerJobs: 3,
  },
  {
    id: 5, title: "Garden Maintenance", category: "Gardeners",
    location: "Gisozi", amount: 5000, period: "half-day", posted: 0, slots: 1, urgent: false,
    description: "Monthly garden maintenance for a private home in Gisozi. Work includes lawn mowing, hedge trimming, weeding, and general tidying. Half-day job, once per month.",
    requirements: ["Experience with garden tools", "Familiar with common Rwandan plants", "Own tools preferred"],
    employerName: "Niyonzima Residence", employerJobs: 1,
  },
  {
    id: 6, title: "Electrician - Full Wiring", category: "Electricians",
    location: "Kicukiro", amount: 15000, period: "job", posted: 3, slots: 1, urgent: false,
    description: "New 3-bedroom house in Kicukiro needs complete electrical wiring - from the meter box to all rooms, including outdoor lighting, kitchen sockets, and CCTV power points.",
    requirements: ["REMA-licensed electrician", "Experience in residential wiring", "Familiarity with Rwanda electrical codes", "Can complete within 5 days"],
    employerName: "Habimana Construction", employerJobs: 9,
  },
  {
    id: 7, title: "House Deep Clean", category: "Cleaners",
    location: "Gikondo", amount: 7000, period: "day", posted: 1, slots: 2, urgent: true,
    description: "Post-renovation deep clean needed for a 4-bedroom house in Gikondo. Construction dust, paint residue, and general grime throughout. Need 2 cleaners for 1 full day.",
    requirements: ["Post-construction cleaning experience", "Bring own equipment and products", "Available this weekend", "Team of 2 required"],
    employerName: "Gikondo Homeowner", employerJobs: 2,
  },
  {
    id: 8, title: "Wedding Photographer", category: "Photographers",
    location: "Kimihurura", amount: 25000, period: "event", posted: 0, slots: 1, urgent: false,
    description: "Looking for a talented photographer for a wedding ceremony and reception at Hotel Diplomat on the 28th. Full coverage from 10am to 6pm. Edited photos delivered within 5 days.",
    requirements: ["Professional DSLR or mirrorless camera", "Portfolio of previous weddings", "Includes basic editing", "Backup equipment required"],
    employerName: "Uwera–Kagabo Family", employerJobs: 0,
  },
  {
    id: 9, title: "Moving Help (Heavy Loads)", category: "Movers",
    location: "Kanombe", amount: 9000, period: "day", posted: 4, slots: 4, urgent: false,
    description: "3-bedroom house move from Kanombe to Kibagabaga. Lots of heavy furniture including a wardrobe, fridge, and sofa set. Need 4 strong workers for Saturday morning.",
    requirements: ["Physically strong", "Experience with heavy lifting", "Careful handling of furniture", "Available Saturday 8am–2pm"],
    employerName: "Mugabo A.", employerJobs: 1,
  },
  {
    id: 10, title: "Live-in Domestic Helper", category: "Domestic Help",
    location: "Kacyiru", amount: 6000, period: "day", posted: 2, slots: 1, urgent: false,
    description: "Family of 4 in Kacyiru seeks a live-in domestic helper for cooking, cleaning, laundry, and light childcare. Private room and meals provided. 6-day working week.",
    requirements: ["Honest and trustworthy with references", "Cooking skills (Rwandan cuisine)", "Experience with children preferred", "Live-in arrangement"],
    employerName: "Habimana Family", employerJobs: 5,
  },
  {
    id: 11, title: "Plumber - Fix Pipe Leak", category: "Plumbers",
    location: "Remera", amount: 12000, period: "job", posted: 1, slots: 1, urgent: true,
    description: "Urgent - water pipe leaking inside the wall of our bathroom in Remera. We need a skilled plumber who can diagnose and fix the leak today or tomorrow. Parts will be paid separately.",
    requirements: ["Experienced with pipe repair and leak detection", "Available immediately or tomorrow", "References from past clients"],
    employerName: "Nshuti Residence", employerJobs: 3,
  },
  {
    id: 12, title: "Construction Labourer", category: "Construction",
    location: "Gikondo", amount: 8500, period: "day", posted: 5, slots: 6, urgent: false,
    description: "Construction site in Gikondo needs 6 general labourers for a 2-week project - mixing concrete, carrying materials, and assisting skilled workers. Daily pay, tools provided.",
    requirements: ["Physically fit", "Construction site experience", "Safety boot required (can be provided)", "Available Monday–Saturday for 2 weeks"],
    employerName: "BuildRwanda Ltd", employerJobs: 31,
  },
  {
    id: 13, title: "Restaurant Waiter x2", category: "Waiters",
    location: "Kicukiro", amount: 7500, period: "day", posted: 0, slots: 2, urgent: true,
    description: "New restaurant in Kicukiro opening this weekend needs 2 experienced waiters to cover lunch and dinner service. Uniforms provided. Potential for long-term hire if the weekend goes well.",
    requirements: ["Restaurant serving experience", "Friendly personality", "Quick learner", "Available Friday evening through Sunday"],
    employerName: "Kicukiro Bistro", employerJobs: 0,
  },
  {
    id: 14, title: "School Cleaner", category: "Cleaners",
    location: "Gisozi", amount: 5500, period: "day", posted: 3, slots: 1, urgent: false,
    description: "Primary school in Gisozi needs a cleaner for 6 classrooms, 4 offices, corridors, and 2 washroom blocks. Hours: 5:30am–8:30am, Monday to Friday. Monthly contract.",
    requirements: ["Reliable and punctual", "Experience in institutional cleaning", "References from previous employer"],
    employerName: "Green Hills Academy", employerJobs: 8,
  },
  {
    id: 15, title: "Night Club Security", category: "Security",
    location: "Nyamirambo", amount: 11000, period: "night", posted: 1, slots: 3, urgent: false,
    description: "Busy nightclub in Nyamirambo looking for 3 experienced security staff for Friday and Saturday nights. 10pm–4am shifts. Must be calm under pressure and experienced with crowd management.",
    requirements: ["NPPA security licence", "Crowd management experience", "Physically imposing presence", "No criminal record"],
    employerName: "Club Nyamirambo", employerJobs: 17,
  },
];
