# AIProDucate — Development Plan (POC → V1 → Expand)

## 1) Objectives
- Deliver a working cross-platform (web) MVP of **AIProDucate** using **React + FastAPI + Supabase Postgres**.
- Validate critical integrations early: **Supabase Postgres**, **AWS S3 uploads**, **Google Gemini (Emergent key)**.
- Implement production sequence modules: **Auth → Eval Mgmt → Question Bank → AI Gen → Student Exam → Leaderboard/Auto-grade → Manual Correction**.
- Enforce **Strict Creator Ownership (RBAC)** and **no stored-procedure business logic** (all in FastAPI).

---

## 2) Implementation Steps

### Phase 1 — Core POC (Isolation) (must pass before building full UI)
**Goal:** Prove the 3 failure-prone cores work end-to-end with real services.

User stories:
1. As an admin, I can connect to Supabase Postgres and read/write a simple record reliably.
2. As an admin, I can upload a file to S3 via a presigned URL and then download it.
3. As a content creator, I can call Gemini to generate a structured JSON of questions from text.
4. As a system, I can auto-grade a Multiple Select question using toggles A/B/C deterministically.
5. As a student, I can submit an answer and server-side time validation rejects late submissions.

Steps:
- Add backend configuration for **Supabase Postgres** (async SQLAlchemy) + health check.
- Add **S3 presigned URL** endpoints (PUT for upload, GET for retrieval) + minimal test file.
- Add **Gemini POC script** (backend route + standalone test) that returns JSON matching a strict schema.
- Implement **auto-grading library** for objective types (SS/MS/FIB/MTF/SEQ/TOGGLE) + unit tests.
- Implement **server time validation** for attempts/responses (started_at + duration, question_started_at + limit).
- Websearch: confirm best practices for **presigned S3 uploads** and **Gemini structured output** constraints.

Exit criteria:
- POC scripts + endpoints succeed against real Supabase/S3/Gemini.
- Auto-grading tests pass for all penalty toggles.

---

### Phase 2 — V1 App Development (MVP UI + Core Flows)
**Goal:** Build a cohesive dashboard + student exam flow around proven POC cores.

User stories:
1. As an admin, I can login and see a dashboard with the 5 tabs.
2. As a creator, I can create/edit an evaluation and toggle key settings (shuffle, navigation, results, proctoring).
3. As a creator, I can create sections and questions and preview them as a student would.
4. As a creator, I can generate questions via AI and save selected ones into my evaluation.
5. As a student, I can discover my invited/public evaluations and start an attempt.
6. As a student, I can answer questions with a countdown timer and a navigation grid (answered/bookmarked/unattended).

Backend (FastAPI):
- Replace Mongo scaffolding with **Postgres async SQLAlchemy** project structure:
  - `/auth`, `/evaluations`, `/sections`, `/questions`, `/ai`, `/attempts`, `/grading`, `/uploads`.
- Auth: JWT login, role guards, and **creator-ownership checks** on every mutate endpoint.
- Evaluation Management:
  - CRUD evals, lock eval once any attempt exists.
  - Attendee assignment: manual IDs + cohort-based resolution.
- Question Bank:
  - CRUD sections, CRUD questions/options, rich content_html.
  - Validation for question payloads per question_type.
- AI Question Bank:
  - Prompt + optional file-text extraction; Gemini returns draft questions; save selected.
- Student Exam Engine:
  - Start attempt → generate attempt_responses order with shuffle rules.
  - Submit response endpoints with offline-friendly idempotency and server-time validation.
- Uploads:
  - Presigned S3 URLs for file/audio; store URLs in attempt_responses.cloud_attachment_urls.

Frontend (React):
- App shell with sidebar tabs: Evaluation Mgmt, Question Bank, Manual Correction (stub), Leaderboard (stub), Student Portal.
- Material-leaning UI with cards, skeletons, toasts.
- Evaluation Management screens: list cards + create/edit modal + attendee assignment UI.
- Question Bank screens: section modal + question editor (MVP: HTML editor/textarea, preview pane).
- AI modal: paste/upload context → generate → checklist → save.
- Student Portal:
  - discovery lists (public/invited), attempt start, exam runner with timer + nav grid + bookmark.

Testing (end of Phase 2):
- 1 full E2E pass: create eval → add section/questions → generate 1 AI question → start attempt → answer → submit.
- Fix all broken flows before moving on.

---

### Phase 3 — Scoring, Leaderboard, Item Analysis (Productionizing the exam results)
User stories:
1. As a creator, I can compute final scores including negative marks and penalty toggles.
2. As a creator, I can see a leaderboard ranked by total_score.
3. As a creator, I can see item analysis (correct rate, avg time) per question.
4. As a student, I can see results if show_instant_results is enabled.
5. As a system, I can issue pass/fail and attach certificate URL when passing_percentage is set.

Steps:
- Implement scoring aggregation endpoint:
  - sum(auto_graded_marks + manual_marks), compute is_passed.
- Leaderboard endpoint + UI table.
- Item analysis endpoint: per question stats from attempt_responses.
- Certificate generation (MVP): generate PDF, upload to S3, store certificate_issued_url.
- Testing: E2E attempt with mixed objective types + verify leaderboard + analysis.

---

### Phase 4 — Manual Correction + Examiner Allocation + Workload Transfer
User stories:
1. As an admin, I can add examiners to an evaluation with max limits and optional section filters.
2. As an admin, I can allocate pending subjective responses round-robin.
3. As an examiner, I can see my assigned responses and submit manual marks + remarks.
4. As an admin, I can transfer workload from one examiner to another (uncorrected or all).
5. As an admin, I can download all attachments for an evaluation.

Steps:
- Allocation engine (no stored procs): round-robin assignment with limits + filters.
- Examiner portal views + correction submission endpoints.
- Transfer tool endpoints + audit logs.
- UI tables with filters and progress bars.
- Testing: allocate → correct → transfer → verify counts and scoring.

---

### Phase 5 — Proctoring (MVP) + Offline-first queue hardening
User stories:
1. As a creator, I can enable proctoring for an evaluation.
2. As a student, tab-switch/minimize logs an infraction.
3. As a creator, I can review proctoring logs per attempt.
4. As a student, intermittent network doesn’t lose answers (queued locally).
5. As a system, submission is blocked until queued answers sync.

Steps:
- Frontend focus/visibility listeners → log events.
- (Optional) webcam snapshots MVP: capture image periodically → S3 upload → log URL.
- Offline queue (localStorage/IndexedDB) + retry strategy.
- Testing: simulate offline, tab switch, ensure logs + sync.

---

## 3) Next Actions (Immediate)
1. Add backend env/config for Supabase Postgres + connect using async SQLAlchemy.
2. Implement Phase 1 POC scripts/endpoints:
   - Postgres read/write
   - S3 presigned upload/download
   - Gemini generate-questions returning strict JSON
   - Auto-grading unit tests for toggles A/B/C
3. Once Phase 1 passes, scaffold Phase 2 endpoints + React dashboard shell.

---

## 4) Success Criteria
- Phase 1: Supabase, S3, Gemini integrations verified with real requests; grading tests green.
- Phase 2: A creator can build an evaluation + questions (including AI-generated) and a student can complete an attempt successfully.
- Phase 3: Scores + leaderboard + item analysis are correct and consistent with penalty rules.
- Phase 4: Subjective questions can be allocated, corrected, transferred, and reflected in final scores.
- Phase 5: Proctoring events are logged; offline queue prevents data loss; submission enforces sync.
