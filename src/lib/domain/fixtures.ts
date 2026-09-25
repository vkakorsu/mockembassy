import { CaseProfile } from "./case";

/** Sample confirmed profiles used by tests and the marketing demo. Fictional. */

export const amaF1 = CaseProfile.parse({
  version: 1,
  visaType: "F1",
  applicant: { firstName: "Ama", age: 24, maritalStatus: "single", children: 0, city: "Kumasi" },
  study: {
    school: "University of Cincinnati",
    program: "MS Data Science",
    level: "masters",
    startTerm: "Fall 2027",
    i20Year1CostUsd: 52000,
    currentOccupation: "Data analyst",
    postStudyPlan: "Return to lead analytics at an Accra fintech",
  },
  funding: {
    sponsors: [{ relationship: "father", occupation: "Cocoa exporter", annualIncomeUsd: 60000 }],
    liquidFundsUsd: 41000,
    recentLargeDepositUsd: 18000,
  },
  ties: { employer: "Hubtel", role: "Data analyst", yearsEmployed: 2, ownsBusiness: false, ownsProperty: false },
  history: { priorUsVisits: 0, otherCountriesVisited: ["Togo"], priorRefusals: [] },
  usContacts: [{ relationship: "cousin", city: "Columbus", status: "citizen" }],
});

export const kofiB1B2 = CaseProfile.parse({
  version: 1,
  visaType: "B1B2",
  applicant: { firstName: "Kofi", age: 58, maritalStatus: "married", children: 3, city: "Accra" },
  visit: { purpose: "Attend daughter's graduation", durationDays: 21, hostRelationship: "daughter", hostCity: "Houston" },
  funding: {
    sponsors: [{ relationship: "self", occupation: "Retired headmaster" }],
    liquidFundsUsd: 9000,
  },
  ties: { ownsBusiness: false, ownsProperty: true },
  history: { priorUsVisits: 0, otherCountriesVisited: ["UK"], priorRefusals: [{ year: 2023, section: "214b" }] },
  usContacts: [{ relationship: "daughter", city: "Houston", status: "visa_holder" }],
});
