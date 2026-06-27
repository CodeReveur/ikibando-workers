/* Shared mock data + helpers for all dashboard pages */

export type Role = "worker" | "employer";

export interface Session {
  name: string;
  email: string;
  phone: string;
  role: Role;
}

export const fmt = (n: number) => `RWF ${n.toLocaleString()}`;

export const ST: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: "Pending",   color: "#f59e0b", bg: "rgba(245,158,11,0.08)"  },
  accepted:  { label: "Accepted",  color: "#22c55e", bg: "rgba(34,197,94,0.08)"   },
  rejected:  { label: "Rejected",  color: "#ef4444", bg: "rgba(239,68,68,0.08)"   },
  upcoming:  { label: "Upcoming",  color: "#60a5fa", bg: "rgba(96,165,250,0.08)"  },
  completed: { label: "Completed", color: "#22c55e", bg: "rgba(34,197,94,0.08)"   },
  released:  { label: "Released",  color: "#22c55e", bg: "rgba(34,197,94,0.08)"   },
  held:      { label: "In escrow", color: "#f59e0b", bg: "rgba(245,158,11,0.08)"  },
  filled:    { label: "Filled",    color: "#a3e635", bg: "rgba(163,230,53,0.08)"  },
  open:      { label: "Open",      color: "#60a5fa", bg: "rgba(96,165,250,0.08)"  },
};

export const MOCK_APPLICATIONS = [
  { id:1, title:"Event Waiter Needed",   employer:"Capital Group Rwanda",  location:"Kacyiru",  amount:8000,  status:"accepted", appliedAt:"2 hours ago",  bestFit:"4 years serving at corporate events" },
  { id:2, title:"Restaurant Waiter x2", employer:"Kicukiro Bistro",        location:"Kicukiro", amount:7500,  status:"pending",  appliedAt:"1 day ago",    bestFit:"" },
  { id:3, title:"House Deep Clean",      employer:"Gikondo Homeowner",      location:"Gikondo",  amount:7000,  status:"rejected", appliedAt:"3 days ago",   bestFit:"5 years professional cleaning" },
  { id:4, title:"School Cleaner",        employer:"Green Hills Academy",    location:"Gisozi",   amount:5500,  status:"pending",  appliedAt:"5 days ago",   bestFit:"" },
];

export const MOCK_JOBS = [
  { id:1, title:"Event Waiter – Capital Group",   location:"Kacyiru",    date:"Sat 22 Jun", time:"5:00 PM",  amount:8000,  status:"upcoming"   },
  { id:2, title:"Restaurant Waiter – Kicukiro",   location:"Kicukiro",   date:"Sun 23 Jun", time:"12:00 PM", amount:7500,  status:"upcoming"   },
  { id:3, title:"Office Cleaning – Digital Hub",  location:"Remera",     date:"Mon 17 Jun", time:"7:00 AM",  amount:6500,  status:"completed"  },
  { id:4, title:"Security – Kimihurura Compound", location:"Kimihurura", date:"Fri 14 Jun", time:"7:00 PM",  amount:10000, status:"completed"  },
];

export const MOCK_TRANSACTIONS = [
  { id:1, label:"Office Cleaning – Digital Hub",    amount:6500,  type:"credit", date:"Today"       },
  { id:2, label:"Platform fee (5%)",                amount:325,   type:"debit",  date:"Today"       },
  { id:3, label:"Security – Kimihurura Compound",   amount:10000, type:"credit", date:"3 days ago"  },
  { id:4, label:"Platform fee (5%)",                amount:500,   type:"debit",  date:"3 days ago"  },
  { id:5, label:"Referral bonus – Jean-Claude N.",  amount:1000,  type:"credit", date:"1 week ago"  },
  { id:6, label:"Restaurant Waiter – last month",   amount:7500,  type:"credit", date:"2 weeks ago" },
  { id:7, label:"Platform fee (5%)",                amount:375,   type:"debit",  date:"2 weeks ago" },
];

export const MOCK_OFFERS = [
  { id:1, title:"Event Waiter Needed",  category:"Waiters",  applicants:4, slots:3, filled:false, amount:8000,  posted:"Today",      urgent:true  },
  { id:2, title:"Office Cleaner",       category:"Cleaners", applicants:7, slots:1, filled:true,  amount:6500,  posted:"2 days ago", urgent:false },
  { id:3, title:"Night Security Guard", category:"Security", applicants:2, slots:2, filled:false, amount:10000, posted:"3 days ago", urgent:true  },
];

export const MOCK_WORKERS_HIRED = [
  { id:1, name:"Grace I.",       category:"Cleaners", rating:4.8, jobs:89, date:"Mon 17 Jun", paid:6825,  status:"completed" },
  { id:2, name:"Alice K.",      category:"Security", rating:4.7, jobs:51, date:"Fri 14 Jun", paid:21000, status:"completed" },
  { id:3, name:"Jean Pierre M.",category:"Waiters",  rating:4.9, jobs:42, date:"Sat 22 Jun", paid:25200, status:"upcoming"  },
];

export const MOCK_PAYMENTS = [
  { id:1, label:"Grace I. – Office Cleaning",       amount:6825,  date:"Today",      status:"released" },
  { id:2, label:"Alice K. – Night Security ×2",     amount:21000, date:"3 days ago", status:"released" },
  { id:3, label:"Jean Pierre M. – Event Waiter ×3", amount:25200, date:"Sat 22 Jun", status:"held"     },
];

export const MOCK_NOTIFS = [
  { id:1, text:"Jean Pierre M. accepted your offer for Event Waiter",  time:"5 min ago",   read:false },
  { id:2, text:"Your application to Kicukiro Bistro is under review",  time:"1 hour ago",  read:false },
  { id:3, text:"Payment of RWF 6,825 released to Grace I.",            time:"3 hours ago", read:true  },
  { id:4, text:"New job match: Event Waiter in Kacyiru",               time:"Yesterday",   read:true  },
];

export const MOCK_CHATS = [
  { id:1, name:"Capital Group Rwanda", last:"Looking forward to Friday!", time:"Just now",  unread:2 },
  { id:2, name:"Grace I.",            last:"I'll bring my own supplies.", time:"2 hrs ago", unread:0 },
  { id:3, name:"MpahMapu Support",    last:"Your query has been resolved.", time:"Yesterday", unread:1 },
];

export const WEEKLY_BARS = [
  { day:"Mon", v:0     },
  { day:"Tue", v:6500  },
  { day:"Wed", v:0     },
  { day:"Thu", v:10000 },
  { day:"Fri", v:0     },
  { day:"Sat", v:8000  },
  { day:"Sun", v:7500  },
];

export const EMP_WEEKLY = [
  { day:"Mon", v:0     },
  { day:"Tue", v:6825  },
  { day:"Wed", v:0     },
  { day:"Thu", v:21000 },
  { day:"Fri", v:0     },
  { day:"Sat", v:25200 },
  { day:"Sun", v:0     },
];
