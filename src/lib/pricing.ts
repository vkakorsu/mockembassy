/** Single source of truth for plans (docs/PRICING.md). Prices in GHS, VAT inclusive. */

export interface Plan {
  id: string;
  name: string;
  priceGhs: number;
  cadence: string;
  summary: string;
  features: string[];
  featured?: boolean;
}

export const LAUNCH_PRICE_GHS = 249;
export const LAUNCH_PRICE_LIMIT = 1000;

export const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    priceGhs: 0,
    cadence: "forever",
    summary: "See how the officer will read your case.",
    features: ["Full Case Scan", "One 90-second mock", "Summary debrief", "5 drills"],
  },
  {
    id: "sprint",
    name: "Sprint",
    priceGhs: 149,
    cadence: "14 days",
    summary: "For interviews less than a week away.",
    features: ["3 full mocks", "Full debriefs", "The whole GH₵149 counts toward a Pass upgrade"],
  },
  {
    id: "pass",
    name: "Interview Pass",
    priceGhs: 349,
    cadence: "until your interview",
    summary: "Unlimited practice until your interview, plus 7 days.",
    features: [
      "Unlimited full mocks (fair use)",
      "A new officer every session",
      "Full debriefs and Readiness",
      "Dress rehearsal before the day",
      "WhatsApp drills",
      "Pass reactivates free after a refusal",
    ],
    featured: true,
  },
  {
    id: "coach",
    name: "Pass + Coach",
    priceGhs: 899,
    cadence: "until your interview",
    summary: "Add a 20-minute live mock with a certified human coach.",
    features: ["Everything in the Pass", "Live mock with a certified Coach", "Coach notes shape your next sessions"],
  },
  {
    id: "senior",
    name: "Pass + Senior Expert",
    priceGhs: 1499,
    cadence: "until your interview",
    summary: "A former consular officer or senior visa expert reviews your case.",
    features: ["Everything in the Pass", "Written case review", "25-minute live mock", "Limited slots"],
  },
];

export const formatGhs = (n: number) => (n === 0 ? "Free" : `GH₵${n.toLocaleString("en-GH")}`);
