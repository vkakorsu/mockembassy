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
