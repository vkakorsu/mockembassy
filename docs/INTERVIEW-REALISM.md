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
| Gemini Live replies when it detects the end of your turn. Default settings end the turn after a short silence, which would cut people off mid-thought. | [Gemini Live capabilities](https://ai.google.dev/gemini-api/docs/live-api/capabilities): `silenceDurationMs`, `endOfSpeechSensitivity` | End-of-turn silence is set per officer from 0.5 to 1.1 s, based on patience, with low end-of-speech sensitivity (see "Reply delay" below for why it came down from 0.7–1.6 s). That allows for natural pauses in Ghanaian English. |
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

## 9. A fuller file and an officer who isn't reading a script (26 Sep 2026)

A review found that what we collected about each applicant was the weak link: the officer can only check answers against what is on its file, and the file was about 30 fields, far thinner than a real DS-160. The questions were also scripted lines, so they sounded the same from session to session.

### What the officer's file holds now

| Added | Why an officer cares | Where it comes from |
|---|---|---|
| Full name, date of birth | Identity check at the window | Passport, DS-160 |
| Every sponsor: name, occupation, employer or business, income, how many others they support | "Who else is he paying for?" is where funding stories break | DS-160, sponsor letter |
| Previous education, result, test scores; schools applied to and admitted | Academic preparation, "How many schools admitted you?" | DS-160, transcripts (new document type), I-20 |
| Each past US trip with year and length | "When was your last trip, how long did you stay?" can now be checked | DS-160 |
| Parents', spouse's occupations; siblings | Family ties, and who the sponsor really is | DS-160 |
| Visitors: arrival date, where they'll stay, event, companions, trip cost, monthly income, approved leave, business name and age, what property | The standard B1/B2 follow-ups | DS-160, invitation, employment letter, business registration, property papers |

The confirm form keeps every sponsor, relative, refusal, US trip and test score. Before, it kept only the first of each, so confirming silently dropped a second sponsor read from a document.

### How the officer asks

- **Goals, not lines.** Each topic reaches the officer as a goal ("Find out who pays and whether they can really afford it"), the facts on file to check against, and one example wording it's told not to read out. Follow-ups are built on what the applicant just said: a vague phrase, a new person, a number that doesn't fit.
- **No bluffing.** A topic only carries "your form says…" challenges when the file holds something to compare. Otherwise the officer is told there's nothing on file for it and never to claim otherwise.
- **Wordings the applicant has heard.** The officer lines from the last three sessions go into the brief, and the officer words its questions differently.
- **Wider bank.** 21 → 36 topics: living costs beyond a scholarship, test scores, schools applied to, time since the last degree, family, working while studying, a US job offer, where a visitor stays, income, leave, the business, companions, property.
- **Questions only this applicant would get.** After facts are confirmed, Flash reads the officer's file and writes up to 5 questions a sharp officer would think of when the facts are put side by side (`case-questions.ts`). Each is kept only if every name and number in it is on the file and the facts it rests on are there too; stored questions are checked again against the current file every time they're used, and only the server can write them (migration 18). One appears in about 60% of sessions, never as the opener, and can be drilled.
- **Identity check.** When the file has a name or date of birth, about 30% of real interviews (60% of dress rehearsals) confirm it after the documents. It isn't graded.
- **What Accra actually asks.** Questions applicants report with their outcome (with consent) are matched to topics; topics reported often are chosen more often. Reported text never reaches the officer.

### Still to do

- Existing applicants need to re-confirm their facts to get the new fields and their own questions.
- The per-applicant question writer and the goal-based officer need checking in live sessions: that the officer still keeps questions short, doesn't drift, and records a judgement for each topic.
- Readiness now counts the new topics that apply to a case, so existing applicants' scores may dip until those topics are practised.

## 10. Research review: real transcripts, technology, learning (26 Sep 2026)

### Real West African interviews

[Blessing988/f1_visa_transcripts](https://huggingface.co/datasets/Blessing988/f1_visa_transcripts) (MIT) holds 335 officer→applicant exchanges from about 28 real F-1 interviews, mostly Ghana and Nigeria, as applicants recalled them. Caveat: they're remembered, not recorded, and nearly all ended in approval (people share good news), so they show *how officers talk* better than *who gets refused*.

| Finding | Number | What Okwan does now |
|---|---|---|
| Officer lines are short | median 7 words, 90th percentile 15 | Officer told most lines are under ten words; fragments are fine. The admin quality page compares ours with these numbers. |
| Many lines aren't questions | 45%: "I see you have a scholarship.", "Okay.", "pass me your documents" | Officer told to react briefly to the file or the answer, then go on. |
| Interviews are brief | median 9 officer lines (range 2–43) | Unchanged: 2–4 topics plus follow-ups and quick checks. |
| Rapid factual checks | "Are you married?", "Any kids?", "Graduated when?", "Have you travelled before?" | **Quick checks**: 1–2 per interview (2–3 in a dress rehearsal), only for facts on the file and not covered by a planned topic. A mismatch is pressed, then logged. |
| Officers look at documents a lot | about 13% of lines: statements, certificates, offer letters; "this is a photocopy" | **Document asks**: in about half of real interviews the officer asks to see a folder document that fits a planned topic. |
| Recited answers get called out | "No no, don't give me crammed stuff here" | Impatient or sceptical officers stop a recited answer ("Don't recite. Just tell me simply."). |
| How they found the school, and whether they understand their field | "How did you get to know about Purdue?", "Catalysis? What's that?" | New topics: how they found the school or won funding, and explaining their field in plain words (weighted up for master's and PhD). |
| Accra decision wording | "I'm approving your visa", a slip for collecting the passport from DHL, "Are you in Accra or Kumasi?" | Approval line updated. |

### Policy (checked 26 Sep 2026)

- Ghana F-1 refusals: 81% in 2025 (72% in 2024); Accra approved about 25,000 of 61,000 applications in 2025 ([Newsweek](https://www.newsweek.com/us-student-visa-refusals-hit-record-high-11818845), [GH Educate](https://gheducate.com/us-embassy-in-ghana-approves-only-25000-visas-out-of-61000-applications-in-2025/)).
- Ghana is not in the June 2025 or December 2025 travel-ban proclamations ([NAFSA](https://www.nafsa.org/regulatory-information/proclamation-december-16-2025-travel-ban-effective-january-1-2026)).
- Since 6 Sep 2025, applicants interview in their country of nationality or residence ([NAFSA](https://www.nafsa.org/regulatory-information/dos-announces-niv-applicants-should-schedule-visa-interview-appointments)). **Added**: nationality on the profile; a non-Ghanaian gets a key "living in Ghana" topic and a Case Scan flag.
- F, M and J applicants must make social media public; officers check it matches the stated purpose ([Shorelight](https://shorelight.com/student-stories/us-visa-social-media-vetting)). Still a Case Scan flag only.

### Technology

| Area | Finding | Recommendation |
|---|---|---|
| Dropped connections | Live sessions can resume with `sessionResumption`, and a single-use ephemeral token can reconnect within its lifetime ([session management](https://ai.google.dev/gemini-api/docs/live-api/session-management), [ephemeral tokens](https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens)). Today a drop after the first answer ends the interview. | **Next**: add resumption to the locked config and reconnect in the window. Needs a live test that a locked token accepts the handle. |
| Turn-taking | Gemini's built-in detection is silence-based. Audio turn detectors (LiveKit, Pipecat Smart Turn) use intonation as well as silence, but LiveKit's supports 14 languages and says nothing about accents ([LiveKit](https://docs.livekit.io/agents/logic/turns/turn-detector/)). | Keep Gemini's detection for now. Revisit with the server-side agent below, testing on recorded Ghanaian answers first. |
| Server-side agent | LiveKit Agents can run Gemini Live on the server with tools executed there ([LiveKit Gemini plugin](https://docs.livekit.io/agents/models/realtime/plugins/gemini/)), which closes the "tool calls pass through the browser" gap. | Worth doing before scale; it's the biggest remaining integrity gap. |
| Affective dialog, proactive audio | Available on some Live models, but not documented for the 3.x Live line ([capabilities](https://ai.google.dev/gemini-api/docs/live-api/capabilities)). | Test on `gemini-3.8-live` via the health page before relying on them. Proactive audio would let the officer ignore "um" and muttering. |
| Speech recognition | Ghanaian English word error rate: Gemini 2.5 Flash about 23%, Whisper large-v3 about 27%; a specialist model (Intron Sahara V2) about 15% overall. Names and numbers are worst for everyone ([AfriSpeech-MultiBench](https://arxiv.org/html/2511.14255)). | Keep the correction flow. Trial a specialist model for the second transcript used in grading. |
| Voice agent QA | Teams test voice agents with simulated callers (accents, noise, interruptions) and track latency and tool calls ([Hamming guide](https://hamming.ai/resources/voice-agent-testing-guide)). | Build the nightly scripted-applicant run (§8 item 2) with recorded Ghanaian-accented answers. |

### Role-play realism and learning

- LLM role-players overshare, drift across turns and are too verbose. What works is restricting what the model can see, not telling it how to behave: the best simulated patient was judged authentic 49% of the time, close to human actors at 53% ([Patients With Personality](https://arxiv.org/html/2606.17441), [EasyMED](https://arxiv.org/html/2511.14783v3)). Okwan's file-versus-folder split already works this way.
- Measure realism the same way: blind "real or Okwan?" judgements on transcripts, using the real transcripts above as the human reference.
- Stress inoculation training reduces anxiety and improves performance under pressure when the pressure rises gradually (meta-analysis of 37 studies; [Saunders et al.](https://www.researchgate.net/publication/13725612_The_effect_of_stress_inoculation_training_on_anxiety_and_performance)). This supports tougher officers as readiness rises, and the dress rehearsal.

### Market

Permito, VisaInterview.ai, visavi, MockVisa, YMGrad and others offer voice mocks with follow-ups and verdicts ([comparison](https://www.visainterview.ai/blog/best-ai-visa-interview-prep-tools-2026)). None of those checked builds the officer's file from the applicant's own DS-160 and documents, or models one embassy. That is Okwan's advantage. Some sell "approved or refund" guarantees; Okwan deliberately gives no approval odds.

### Open questions for Phase 0 (ask 20–30 recent Accra applicants)

1. Where are fingerprints taken: at a separate window before the interview, and does the officer re-scan at the window?
2. Is the I-20 handed through, or only the passport? Do officers ask for the DS-160 confirmation page?
3. How is a refusal delivered: the letter's colour and wording, and do officers say "214(b)" aloud?
4. How often do officers ask to see bank statements, certificates or photos?
5. Do officers ask about social media?
6. Glass and microphone: how clear is the sound, and is there noise from other windows?

## 11. Readiness (26 Sep 2026)

Readiness says how prepared the applicant is, never a chance of approval. The old score had several problems:
- It counted "adequate" as fully good, which the Referee's sceptical officers don't.
- It never checked for a tough officer, although the homepage promised one.
- It let two drills a minute apart "confirm" a topic.
- Nothing faded with time.
- One weak answer wiped a topic, and the steadier debrief grades were ignored.
- Every relevant topic counted the same.
- It could reach 100% without ever passing a full interview.

### The model (`src/lib/domain/readiness.ts`)

**Each answer on a topic** is one piece of evidence:
- **Quality:** strong 1, adequate 0.6, weak 0.15, contradiction 0. It's averaged with the independent debrief grade when there is one; the grader runs twice with anchored scores, so it's steadier than the live officer.
- **Weight:** the setting (dress rehearsal 1.2, interview 1, practice 0.8, drill 0.6) × officer toughness (0.75–1.25) × recency (half-life 21 days) × 0.5 if the same topic was answered within the previous 30 minutes (cramming).

**Per topic,** mastery = quality × confidence:
- **Quality** is weighted towards the latest answers (each later answer halves the say of the ones before), because people improve.
- **Confidence** is 1 − e^(−total weight): one interview answer ≈ 63%, two ≈ 86%, three ≈ 95%. Old evidence fades.
- **Caps:** a weak latest answer caps the topic at 30%. Until two different officers, one of them tough (scepticism ≥ 0.6, or a dress rehearsal), have heard it answered well since the last weak answer, it's capped at 70%.
- **Status:** untested, weak, improving or solid.

**Topics** are weighted by importance: key topics count 2, others count their likelihood of being asked squared (so rarely asked topics count little). Surprise questions are left out.

**The overall score** is the weighted mean, then capped:
- 60% if the latest full interview had an answer that contradicted the file;
- 75% while a key topic is untested or weak;
- 90% until a full interview or dress rehearsal has been passed with a tough officer in the last three weeks.

**Levels** follow the percentage shown: Building (under 45%), Getting close (45–74%), Nearly ready (75–89%), Well prepared (90%+).

A simulated applicant who is weak the first time on every topic and strong afterwards goes from 10% to 90% over 15 daily interviews with drills, and fades to 74% after 30 idle days. "Adequate" answers alone top out around 60%, in line with the Referee: a sceptical officer refuses adequate answers.

### Related fixes

- The planner's "solid" (`probeStatus`) now needs a tough officer too, so it keeps re-testing until one has confirmed it.
- A contradiction found by a quick check is recorded as `check:facts` (a fact on the form), not against whichever topic came first. The Referee treats it as a key contradiction.
- The case header shows the level and whichever cap is holding the score down, and says it isn't a chance of approval. "Answers to fix" comes from the new per-topic statuses.

### Still to validate

Calibrate against real outcomes. When applicants report results (`outcomes`), compare their readiness on interview day with approval. The score shouldn't predict approval (case strength matters more than practice), but a well-prepared applicant being refused for answers they had practised is a sign the model over-credits something.
