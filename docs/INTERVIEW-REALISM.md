# How close the interview is to the real thing

Research review, 26 Sep 2026. The goal is a simulation that behaves like a real US nonimmigrant visa interview at the embassy in Accra, and is technically sound. Each point below lists the evidence, what the engine does about it, and what is still unverified.

## 1. What the officer is actually deciding

| Real-world rule | Source | What Okwan does |
|---|---|---|
| Applicants are presumed to be intending immigrants until they prove otherwise (INA 214(b)). The burden is on the applicant; if the officer isn't convinced, the applicant isn't eligible. | 9 FAM 302.1-2 | The Referee refuses unless the key answers clear a bar, and a sceptical officer raises the bar (`referee.ts`). The officer's instructions say the burden is on the applicant. |
| Officers decide on the totality of the circumstances: employment, family, finances and social ties. The residence abroad doesn't have to be where the applicant lives now. | 9 FAM 302.1-2, 9 FAM 402.2 | Probes cover purpose, funding, ties, US contacts and history. The decision weighs all key answers together, not one "magic" answer. |
| **Students:** officers judge *present* intent to depart. Young students aren't expected to have long-range plans, and a plan that may change isn't disqualifying. | 9 FAM 402.5-5 | The "after graduation" probe expects an honest present intention from young students and a specific plan only from mid-career applicants. The grader is told the same. |
| **Students:** officers normally don't second-guess the school's admission (the I-20 or SEVIS record), but may check English and academic preparation. | 9 FAM 402.5-5 | Adds an optional academic-preparation and English probe. The officer never questions the admission itself. |
| Every applicant signs the DS-160, and the fingerprint scan certifies the answers under penalty of perjury. | 9 FAM 403.5 | The officer's file is the confirmed case profile. Contradictions with it are logged and weigh heavily. |
| Interview length varies: some end after two questions, others go deeper. Officers often decide within the first minute. | [VisaMet](https://visamet.com/guides/us-visa-interview-questions-2026-guide) | Each session gets its own target length (60–240 s). Early decisions are allowed when the first key answers are strong, and the debrief grades your first minute separately. |
| **Visa bond:** applies only to B1/B2 applicants from designated countries. Ghana is not designated (checked 26 Sep 2026). | [State Dept](https://www.state.gov/releases/office-of-the-spokesperson/2026/03/state-department-expands-visa-bonds-to-combat-illegal-overstay-rates), [Federal Register](https://www.federalregister.gov/documents/2026/08/03/2026-15726/visas-visa-bond-program) | No bond logic. If Ghana is ever designated, the Referee needs a "qualifies, bond required (221(g))" outcome, since that's how officers apply it. |

## 2. How the conversation behaves

| Issue | Evidence | What Okwan does |
|---|---|---|
| Gemini Live replies when it detects the end of your turn. Default settings end the turn after a short silence, which would cut people off mid-thought. | [Gemini Live capabilities](https://ai.google.dev/gemini-api/docs/live-api/capabilities): `silenceDurationMs`, `endOfSpeechSensitivity` | End-of-turn silence is set per officer from 0.7 to 1.6 s, based on patience, with low end-of-speech sensitivity. That allows for natural pauses in Ghanaian English. |
| The model doesn't interrupt a speaker by itself, because it waits for the end of the turn. Real officers do cut in. | Same | The client times each answer. An impatient officer (or a planned cut-in) gets a `[REFEREE] Cut in` message after 15–35 s, and the officer then interrupts politely. **To verify on the live model:** that a mid-speech client message produces the cut-in reliably. |
| A model can't truly "stay silent while typing". | Same | The client holds the officer's next audio for 3–5.5 s on one turn when the plan includes a typing silence. |
| An American officer voice. | [Configure language and voice](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/live-api/configure-language-voice) | `languageCode: en-US`, plus a Live prebuilt voice per officer. |
| Real interviews open with a greeting and the passport (and I-20 for students) passed through the slot. | Common consular practice | The officer opens that way. **To verify locally:** the exact sequence at Accra (fingerprints at a separate window or at the interview window). This is Phase 0 research with recent applicants. |

## 3. Grading that's fair and repeatable

| Issue | Evidence | What Okwan does |
|---|---|---|
| AI graders vary from run to run and need anchored rubrics plus calibration against human judgement. | [Agreement measurement for rubric-based judges](https://arxiv.org/html/2606.00093), [Reliability without validity](https://arxiv.org/html/2606.19544v1), [Calibrating judges](https://galileo.ai/blog/calibrate-llm-judge-human-annotations) | Written 1–5 anchors for each score, temperature 0, and **two runs merged**: scores averaged, and a red flag kept only if both runs raised it. The agreement between runs is stored for monitoring. **Still to do:** a 100–300-answer human calibration set, scored by the expert advisors. |
| Speech recognition has about 30% word-error rate on West African-accented English. | [AfriSpeech-MultiBench](https://arxiv.org/abs/2511.14255) | The grader is told not to penalise transcription errors, accent or grammar. **Users can correct a mis-heard answer and get re-graded** (up to 5 times per session). |
| "Stronger answers" must never invent facts, because misrepresentation is a permanent bar. | INA 212(a)(6)(C)(i) | A deterministic validator blocks any rewrite containing names or numbers that aren't in the confirmed facts or the user's own words. |
| The live officer's judgement drives the outcome. | — | The Referee applies fixed rules to the officer's per-answer judgements, and the debrief is graded independently. A big gap between the two is a signal to investigate in the admin quality page. |

## 4. Known gaps (be honest about these)

- **Tool calls pass through the browser**, so a determined user can fake their own practice scores. A server-side agent (LiveKit) removes this.
- **Transcript turns** are built from Gemini's live transcription. A post-session pass with Gemini 3.5 Transcribe would give word timestamps and better turn boundaries.
- **Model ids** (`gemini-3.8-live`, `gemini-3.8-flash`) need checking against the live API before launch.
- **No real Accra interview transcripts yet** to benchmark realism against. That's the Phase 0 plan: 20–30 recent applicants, plus a blind real-vs-simulated test.

## 5. First live run (26 Sep 2026)

What the first real session showed, and what changed:

| Seen | Cause | Fix |
|---|---|---|
| Officer went silent after an answer | The model sometimes ends its turn with only a `log_probe` call; the tool response is silent, so nothing follows | Prompt: keep the interview moving in the same turn. Client: if the applicant stopped talking 4.5 s ago and the officer hasn't spoken, a `[REFEREE]` message asks for the next question |
| "Here" transcribed as Hindi, "in Accra" as Spanish | Input transcription auto-detects language | `languageCodes: ["en-US"]` plus custom vocabulary from the case (school, city, sponsor, employer) |
| Officer asked for the passport and the first question in one breath | Opening instruction said "then start" | The document request is the whole first turn; if the applicant passes documents silently, the client tells the officer after 3 s |
| "Approved" after uncertain funding answers, in a session the applicant left early | Officer logged the answers "adequate"; the bar let adequate pass even for a sceptical officer; leaving early still produced a decision | Anchored quality rubric for the officer; bar raised to 0.6 + 0.25 × scepticism; leaving before the key topics are covered gives "No decision" |
| Debrief grading caught what the officer missed (sponsor also funds a cousin; answering with a question) | Independent grader works | Nothing; this gap is what the admin quality page monitors |

## 6. Whole-document understanding

Applicants' cases differ in ways a fixed form can't hold, so each document is now read three ways:

| Layer | What it holds | Who sees it |
|---|---|---|
| Structured profile | ~30 fields (age, school, funds in USD, sponsor, ties…) | Director rules, Referee, officer's file |
| Case notes | Free-form facts specific to this applicant, each with its source quote ("GH₵270,000 deposited 2 Sep, three weeks before the interview") | Only after the user keeps them. Notes from the DS-160, I-20, passport or a refusal letter are on the officer's screen. Other notes stay in the folder until the officer asks for that document (`request_document`, a blocking tool) |
| Full transcription | The whole document as Markdown, with ID and account numbers cut to the last 4 digits, deleted with the document after 30 days | The debrief coach only, to spot what an answer should have mentioned and what evidence is missing. Suggested answers may still use only confirmed facts and notes |

Why not give the officer everything: a real Accra officer works from the DS-160 and SEVIS record and rarely reads a bank statement unless they ask for it. An officer who knows every line would be less realistic, and an unconfirmed misreading could have the officer, or a coaching rewrite, state something untrue.

The Director turns one kept note into a question in most sessions (never the opener, not repeated within two sessions), weighted towards funding and history. For folder notes the officer first asks to see the document. Bank statement amounts are kept in their original currency and converted to USD at `FX_GHS_PER_USD` for the user to confirm.

### Reply delay (second live run)

The officer took ~6 s to answer. It usually ends its turn with only `log_probe`; the browser waited for our server before replying to that call, then told the model to stay silent, so only the 4.5 s watchdog got it talking. Bookkeeping calls are now answered in the browser at once (server relay in the background) with `WHEN_IDLE` when the officer hasn't spoken since the answer, which makes it continue immediately. End-of-turn silence is now 0.5–1.1 s. Each turn records `reply_latency_ms` (end of answer → officer's next audio); the admin quality page shows the median and 90th percentile. Answer timing and cut-ins now come from the mic, not the transcript, which arrives after the answer ends.

### Scans and phone photos

Gemini reads scanned PDFs and photos directly (no separate OCR step). The browser turns photos of several pages into one PDF (rotation fixed, long edge ≤ 2000 px, JPEG): two 23 MB photos became a 3.8 MB PDF in testing. Extraction reports `legibility` (clear / partly unreadable / unreadable) and what couldn't be read, never fills a field from unreadable text, and the documents page asks for a retake.

### Handing documents over

A real applicant passes the passport (and I-20) through the slot. When the officer asks, the window shows **Pass it through the slot**. Pressing it, or saying "here you go", counts; after 8 s it's assumed. Mid-interview requests (`request_document`) wait for the button; **I don't have it** is logged as a missing document, which can lead to a 221(g), as it would at the embassy. A document the applicant has but didn't upload is treated as handed over and unremarkable.

## 7. Learning loop: drills, playback, second transcript

- **Recording**: 16 kHz mono WAV of the applicant's mic, the same audio the officer hears, starting at session time 0, so each turn's `started_ms`/`ended_ms` index straight into it (about 1.9 MB a minute uploaded after the session; 8-minute cap).
- **Second transcript**: after the session each answer is cut from the recording (−0.4 s/+0.8 s) and transcribed again by Flash, verbatim with fillers, with the officer's question and the case's names as context (`turns.user_transcript_asr`). Grading uses the user's correction, then this, then the live transcript.
- **Hear yourself**: every answer on the debrief has a play button (signed URL, seeks to the answer). Delivery notes from the audio: pace (words per speaking minute), pauses of 1.5 s or more, voice dropping at the end, fillers, length. All deterministic.
- **Drills**: one question, a fresh officer, a phrasing not heard recently, at most one follow-up, no verdict. Started from "Practise this one" on any graded answer, "Drill it again" on a drill debrief, or the case page's "Answers to fix" (weak, then improving topics). Drills don't use up mocks or the daily mock limit: 3 free per account, 30 a day with a pass. Their judgements count towards readiness like any other officer's.

## 8. Realism audit (26 Sep 2026)

Research refresh, and how the interview compares, dimension by dimension. "Verified" means checked in a live session; "Built" means implemented but not yet observed live.

### What changed in the world

| Fact | Source | Effect on Okwan |
|---|---|---|
| Ghana's July 2025 cut to single-entry, 3-month visas was reversed on 26 Sep 2025: B1/B2 up to 5 years, F-1 up to 4 years, multiple entry. | [Citi Newsroom](https://www.citinewsroom.com/2025/09/us-reverses-visa-restrictions-on-ghana-restores-five-year-multiple-entry/), [Nairametrics](https://nairametrics.com/2025/09/27/visa-restriction-lifted-u-s-restores-ghana-visa-validity-to-5-years/) | Docs already correct (PLAN.md). |
| Interview waivers ended for most applicants on 2 Sep 2025; renewals interview in person again. | [Ogletree](https://ogletree.com/insights-resources/blog-posts/interview-waiver-no-longer-available-for-most-nonimmigrant-visa-applicants-starting-september-2-2025/), [Boundless](https://www.boundless.com/blog/nonimmigrant-visa-interview-waiver-changes-2025) | More returning visitors. **Added** a key question on past US visits and leaving on time. |
| F, M and J applicants must set social media to public; officers may ask about what they find. | [Shorelight](https://shorelight.com/student-stories/us-visa-social-media-vetting), [US Mission Mexico](https://mx.usembassy.gov/student-visa-social-media-vetting/) | Case Scan flags it; officer questions about posts are rare, so not simulated. |
| Ghana F-1 refusal 81% (2025, up from 72%); B1/B2 adjusted refusal 64.3% (FY25). | [Newsweek](https://www.newsweek.com/us-student-visa-refusals-hit-record-high-11818845), [State Dept FY25](https://travel.state.gov/content/dam/visas/Statistics/Non-Immigrant-Statistics/RefusalRates/FY25.pdf) | Tougher bar for sceptical officers (§5) and fast refusals (below). |
| $250 visa integrity fee is law but, as of March 2026, not yet collected; charged at issuance only. | [Ellis](https://www.ellis.com/resources/visa-integrity-fee), [BU ISSO](https://www.bu.edu/isso/2026/05/19/visa-integrity-fee/) | Nothing in the interview; revisit the checklist when collection starts. |
| Ten-print scan is taken "immediately preceding the visa interview" and the applicant attests under penalty of perjury. | [US Embassy Thailand, interview procedures](https://th.usembassy.gov/nonimmigrant-visa-interview-procedures/), 9 FAM 403.5 | **Added** to the dress rehearsal: the officer verifies fingerprints at the window (left four, right four, thumbs) before questions. Accra's exact choreography is still to confirm. |
| Most interviews last 3–5 minutes in total; the officer has read the DS-160 and forms an impression in the first seconds; long answers read as rehearsed. | [VisaMet](https://visamet.com/guides/us-visa-interview-questions-2026-guide), former-officer accounts | Matches: variable 60–240 s, first-minute grading, cut-ins. **Added** fast refusals. |

### Scorecard

| Dimension | Status | Notes |
|---|---|---|
| Opening: greeting, passport (and I-20) through the slot | Verified | Handover button; silent handover assumed after 8 s. |
| Fingerprint verification at the window | Built | Blocking `scan_fingerprints`; three scanner presses. **Dress rehearsal only**: elsewhere it's time that doesn't train answers, and Accra's exact procedure is unconfirmed. |
| Officer reads the file, not the folder | Verified | On-screen notes vs folder documents requested with `request_document`. |
| Question selection tailored to the case and history | Verified | Director + notes; novelty against the last 3 sessions. |
| Follow-up depth | Built | Now scales with scepticism: 1, 2 or 3 follow-ups on a vague answer (was always 1). |
| Decisions after a contradiction | Built | Every officer presses once on a conflict with the file. If the applicant confirms it, it's recorded (`log_inconsistency`). About a third of officers (more often sceptical, impatient ones; `plan.decidesFast`) then decide soon, after hearing the answer to the challenge; the rest note it, carry on with their other questions, and it weighs on the verdict (a recorded key contradiction still refuses). Two weak key answers end it early only for fast-deciding officers. Never in practice mode. A bare "contradiction" judgement never ends it, since it may come from a mishearing. The debrief lists topics not reached, each with a drill. |
| Reply timing | Verified | Median well under 1 s after the fix; "The officer is typing…" shown during deliberate typing pauses. |
| Interruptions | Built, unverified live | Client-timed cut-ins for impatient officers. Needs a live check. |
| Decision lines | Verified | 214(b), 221(g), approval wording. |
| Hearing the applicant | Verified | Live transcript for the officer; careful second transcript for grading. Live mishearing still affects the officer's follow-ups. |
| Judging answers | Partly verified | Officer rubric + Referee rules + independent grader agree on the sessions seen; no human calibration yet. |
| Sound of the room | Partial | "Through the glass" filter only. |

### Still not perfect (in priority order)

1. **Accra ground truth.** Nobody has confirmed the Accra choreography (where fingerprints happen, whether I-20s are handed over or only checked on screen, glass and microphone, how the decision is delivered) or the question mix. Phase 0: 20–30 recent applicants, then a blind "real or Okwan?" transcript test. Until then these are well-sourced defaults, not facts.
2. **Automated officer regression tests.** Every live session has found a new model quirk. A nightly scripted-applicant run against the real Live model (weak answers, "What?", rambling, silence, documents) should check: one question per turn, no spoken tool calls, waits for handovers, fast refusal on contradictions, reply latency, and the same answers giving the same verdict.
3. **Human calibration of judgements.** 100–300 answers scored by experts, compared with the officer's `log_probe` and the grader.
4. **Live mishearing.** The officer still hears the fast live transcript. If mishearing shows up in follow-ups, add case names as vocabulary to the live session (done for input transcription) and consider a push-to-confirm on names and numbers.
5. **Room sound.** Low embassy ambience (other windows, number calls) would add pressure, but can trip voice activity detection through the mic. Try it behind a setting, with echo cancellation checked on low-end Android phones, before making it the default.
6. **Model drift.** `gemini-3.8-live` can change under us; the health page and the regression run are the guardrails.
