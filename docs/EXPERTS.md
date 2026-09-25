# Okwan Experts: bringing real humans into the product

**Status:** design, written 25 Sep 2026. Prices and margins are in [`PRICING.md`](PRICING.md); the interview engine is in [`PLAN.md`](PLAN.md) §2.2.

The idea: **the AI gives unlimited realistic practice; humans give judgment.** Expert sessions shouldn't be a separate "consultation" bolted on. They happen inside the same Window, use the same case file and debrief format, and **everything an expert notices feeds back into the user's future AI sessions.**

---

## 1. Who the experts are (two tiers)

| Tier | Who | What they do | Pay (guide) |
|---|---|---|---|
| **Okwan Coach** | Ghana-based professionals: experienced education and visa counsellors, former admissions staff, trained public-speaking coaches. **They must pass our certification (§3).** | Live 20-minute mocks, async reviews, parents mode in Twi/Ga/Ewe | GHS 300 per live session including prep; GHS 120 per async review |
| **Senior Expert** | **Former US consular officers** (retired Foreign Service) and senior US-visa professionals with a long, verifiable record | Live 25-minute mocks with a written pre-review, hard cases (prior refusals, complex histories), and quality control of Coaches and of the AI | About $60 per live session including prep; about $25 per async review |

**What experts must not do:**
- No **legal advice**. That includes questions like "should I disclose X?", past misrepresentation findings, overstays and waivers.
- **Legal questions go to partner US immigration attorneys**, whom the user hires and pays directly. There is **no fee-sharing or referral payments**, because US lawyer ethics rules restrict paying for referrals and sharing fees with non-lawyers. Get the partner arrangement reviewed by counsel.
- **No guarantees, no scripts, and no editing of DS-160 answers.** The same trust rules as the product apply.
- **Former officers must not use non-public information** or imply any current link to the State Department. Have a US lawyer review the contract template for post-employment restrictions.

---

## 2. What users get from an expert session

**Live mock (the main format)**
1. **Before the session:** the expert sees a **Pre-session Brief** built automatically by the platform:
   - the Case Profile (only the fields the user has agreed to share)
   - Case Scan flags
   - Readiness and the Consistency-tracker contradictions
   - the **3 weakest recorded answers**, picked by the Referee's probe log, ready to replay

   Senior Experts also write a short case review into it.
2. **The session happens in the Window, with the human as the officer.** It runs through the same LiveKit room as the AI mocks, and the user stands at the same "glass". The first 5–8 minutes are an **unannounced realistic interview**: the expert plays the officer and chooses the outcome. The rest is coaching, face to face, in the same call.
3. **The Referee still runs silently.** It logs probes, answer lengths and contradictions, so the user gets the **same Debrief** as after an AI session, *plus* the expert's notes.
4. **After the session:** within 2 hours, the expert completes a **structured Expert Debrief** (not free-form):
   - a verdict per probe (strong / needs work / risk)
   - the top 3 changes to make
   - probes to drill
   - an overall readiness judgment
   - optional voice notes pinned to moments on the timeline
5. **Feedback into the AI:** probes the expert marked "needs work" get extra weight in the Director's plans for later sessions, and the expert's top 3 changes become checklist items in future debriefs. The expert's advice keeps working for the rest of the pass.

**Async review (the scalable format)**
- The user chooses one of their recorded AI mocks.
- The expert watches the replay and pins voice or text notes to moments on the timeline, plus the structured Expert Debrief, within 48 hours.
- It works across time zones: a US-based Senior can review overnight.

**Matching**
- The user can choose, or we auto-match on:
  - visa type
  - case complexity (a prior refusal or complex history goes to a Senior)
  - language (Twi/Ga/Ewe coaching for parents mode)
  - gender preference
  - the next available slot before the interview date
- **A slot must exist before the interview date, or checkout won't sell the expert plan.** We never sell an expert session we can't deliver.

---

## 3. Vetting and quality control (how we keep experts real)

**Onboarding**
1. **Identity and credential verification:**
   - a government ID check
   - for Senior Experts, proof of service (e.g. Foreign Service records or references and a verifiable employment history) and a live interview with us
   - a background check where lawful
2. **The calibration test.** The candidate grades 10 recorded mocks (a mix of strong, weak and adversarial). Their grades must agree with the **advisor-consensus grades** within tolerance, and they must catch the planted red flags. The same set is used to calibrate the AI, so humans and AI are held to one standard.
3. **Shadow sessions:** 3 shadowed sessions (with the user's consent), reviewed by a Senior Expert.
4. **Signed agreements:** an independent contractor agreement, a **data processing agreement** (experts are sub-processors under Ghana's Act 843), the code of conduct, and a non-solicitation clause.

**Ongoing quality**
- A user rating after every session, plus "Did this feel like the real thing?"
- **Human–AI agreement:** we compare the expert's probe verdicts with the Referee's. Persistent disagreement triggers a review by a Senior, and the result improves either the AI's scoring or the expert's calibration.
- **Monthly audit:** 5% of recorded sessions, recorded with consent from both sides.
- **Tiers and pay:**
  - Experts with a rating of 4.8 or higher and good calibration get priority placement and higher pay.
  - Anyone below 4.3, or with a conduct issue, is suspended while we review.
- **Taking business off the platform:** there is **no chat or contact exchange outside the platform.** Phone numbers and emails are masked, and messages are scanned for contact details. Offering "private sessions" off the platform means removal. Experts who follow the rules get a steady flow of pre-qualified clients without having to market themselves, which is worth more to them than poaching.

---

## 4. Implementation (fits the existing stack)

**Roles and access**
- Supabase Auth roles: `applicant`, `coach`, `senior`, `admin`.
- Row-level security gives an expert access to a case **only through an active booking**. Access opens 24 hours before the session and closes 72 hours after it (async: from assignment until the review is submitted).
- Every read is written to an audit log. Nothing can be downloaded; the app only streams case data, never offers it as files.

**The `/expert` app** (a separate route group in the same Next.js app):
- availability calendar
- booking queue and upcoming sessions
- the Pre-session Brief
- the review studio: a replay timeline with pinned notes
- the Expert Debrief form (Zod schema)
- earnings and payouts
- calibration status

**Scheduling**
- Build it in-house from `availability_rules` and bookable slots, or embed the **Cal.com Platform** API if speed matters more than control.
- Time zones: Ghana is on GMT all year, US experts on ET/PT. **Slots are always shown in the user's local time.**
- WhatsApp and email reminders go out 24 hours and 1 hour before.
- **No-shows and cancellations:**
  - If the **user** doesn't show within 10 minutes, the session counts as used. One free reschedule is allowed if they give 12+ hours' notice.
  - If the **expert** doesn't show, the user gets an automatic free rebooking with priority, plus a free async review. The expert gets a strike.

**Live sessions**
- They use the same LiveKit room type as the AI mocks, with one human participant as the officer and the Referee agent running silently.
- Recording needs explicit consent from both sides. Recordings are kept 90 days, then deleted unless the user keeps them.

**Payouts**
- **Ghana-based coaches:** weekly Paystack Transfers to MoMo (GHS 1 fee each) or to a bank.
- **International Senior Experts:** monthly contractor payouts through Wise Business or Deel, in USD.
- Earnings are held for 72 hours after a session so disputes can be resolved.

**Data model additions**
- `experts`: tier, languages, visa types, bio, verified credentials (reference only), rating, calibration score, status
- `expert_availability`: rules and exceptions
- `bookings`: pass, expert, slot, format (`live` / `async`), status, reschedule count
- `expert_briefs`: the pre-session brief snapshot and the senior's written pre-review
- `expert_debriefs`: structured verdicts per probe, the top 3 changes, and timeline notes
- `expert_calibrations`: test runs and agreement scores
- `payouts`: amount, currency, rail, status
- `expert_audit_log`

**Director integration**
- `expert_debriefs.probe_verdicts` is added to the Director's inputs: expert "needs work" probes are always retested, and never by the same officer profile twice.

---

## 5. Supply: where the first experts come from
- **Coaches (to start: 5–10):**
  - experienced Accra and Kumasi education counsellors (recruited from agencies that will also buy seats)
  - university career-office staff
  - Toastmasters Ghana members for delivery coaching
- **Senior Experts (to start: 2–4):**
  - the same former-officer advisors from Phase 0
  - LinkedIn outreach to retired Foreign Service officers who served in West Africa
  - AFSA (American Foreign Service Association) retiree networks
- **Agencies' own counsellors, in the institutional plan:**
  - They can use the Expert studio for their own students ("bring your own coach") at no per-session cost.
  - This makes agencies stickier, and gives us a pool of future certified Coaches.

---

## 6. Rollout
1. **Phase 1:** Senior Experts only, doing **async reviews** plus a few live sessions (booked by hand). This proves demand and calibrates the Expert Debrief form.
2. **Phase 2:** the Coach certification programme, self-serve booking, the full `/expert` app, and payouts.
3. **Phase 3:** Twi/Ga/Ewe coaches for parents mode, and agency "bring your own coach" seats.
