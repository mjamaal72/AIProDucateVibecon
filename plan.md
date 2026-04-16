# AIProDucate — Development Plan (POC → V1 → Expand) **(Updated — All Phases Complete)**

## 1) Objectives
- Deliver a working web MVP/V1 of **AIProDucate** using **React + FastAPI + Supabase Postgres**.
- Validate and harden critical integrations:
  - **Supabase Postgres** (async SQLAlchemy)
  - **Google Gemini** via **Emergent LLM key**
  - **AWS S3** for file storage (uploads + presigned URLs)
- Implement production sequence modules: **Auth → Eval Mgmt → Question Bank → AI Gen → Student Exam → Leaderboard/Auto-grade → Manual Correction → Proctoring**.
- Enforce **Strict Creator Ownership (RBAC)** and **no stored-procedure business logic** (all in FastAPI).
- Provide V1 analytics and integrity tooling:
  - **Item Analysis** (per-question stats)
  - **Manual correction workflows** (allocation, grading, transfer)
  - **Proctoring logs** (tab switch + window blur)
- Prepare for the next iteration where the user will provide **rectifications/modifications** after planned phases are completed.

**Status summary (as of now):**
- ✅ Phase 1 complete (Postgres + Storage + Gemini + Auto-grading + Timer validation).
- ✅ Phase 2 complete (Core app flows: Auth, Evaluation CRUD, Question Bank, AI generation, Student Portal, Live Exam, Leaderboard).
- ✅ Phase 3 complete (Analytics: Item Analysis + UI).
- ✅ Phase 4 complete (Manual Correction: allocation + round-robin + transfer + grading UI).
- ✅ Phase 5 complete (Proctoring: tab-switch + window blur detection, event logging).
- ✅ Storage finalized: **AWS S3** (permissions fixed) replaces earlier Emergent Object Storage.
- ✅ Testing complete: **Backend 100% (34/34)**, **Frontend 100%**, **Integration 100%**.

---

## 2) Implementation Steps

### Phase 1 — Core POC (Isolation) (must pass before building full UI)
**Goal:** Prove the failure-prone cores work end-to-end with real services.

User stories:
1. As an admin, I can connect to Supabase Postgres and read/write a simple record reliably.
2. As an admin, I can upload a file and then download it.
3. As a content creator, I can call Gemini to generate a structured JSON of questions from text.
4. As a system, I can auto-grade objective question types deterministically.
5. As a student, I can submit an answer and server-side time validation rejects late submissions.

Steps (implemented):
- ✅ Added backend configuration for **Supabase Postgres** (async SQLAlchemy) + health check.
- ✅ Implemented **Gemini POC** using Emergent LLM key returning structured JSON.
- ✅ Implemented **auto-grading library** for objective types (SS/MS/FIB/MTF/SEQ/TOGGLE) + deterministic penalty toggles.
- ✅ Implemented **server time validation** for attempt submissions.
- ✅ Verified file storage pipeline during POC (later standardized to AWS S3 in Phase 5 update).

Exit criteria:
- ✅ POC scripts + endpoints succeed against real Supabase + Gemini + storage.
- ✅ Auto-grading tests pass for all penalty toggles.

**Phase 1 status:** ✅ Completed

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

Backend (FastAPI) (implemented):
- ✅ Replaced Mongo scaffolding with **Postgres async SQLAlchemy** structure.
- ✅ Auth: JWT login/register, role guards.
- ✅ Evaluation Management:
  - CRUD evaluations, toggle active.
  - Auto-lock editing once attempts start.
  - Attendee assignment supported (manual IDs + cohort resolution).
- ✅ Question Bank:
  - CRUD sections, CRUD questions/options, `content_html`.
  - Supports all **9 question types** in schema (6 objective + 3 manual).
- ✅ AI Question Bank:
  - Gemini generate endpoint returning draft questions; bulk-save selected.
- ✅ Student Exam Engine:
  - Start attempt → generate attempt question set with shuffle rules.
  - Submit answers per question with server-time validation.
  - Submit attempt → compute total score; pass/fail when passing_percentage is set.
- ✅ Leaderboard endpoint.

Frontend (React) (implemented):
- ✅ Auth screens: login/register.
- ✅ App shell with sidebar tabs (role-based).
- ✅ Evaluation Management: cards + create/edit modal + search + toggles.
- ✅ Question Bank: evaluation selector + sections + question editor + AI generator modal.
- ✅ Student Portal: discover exams + start/resume attempt + attempts listing.
- ✅ Live Exam Runner: countdown timer, bookmark, navigation grid with legend and color coding.
- ✅ Leaders Board page.

Testing (end of Phase 2):
- ✅ Phase-2 testing iterations completed; later superseded by final comprehensive test suite.

**Phase 2 status:** ✅ Completed

---

### Phase 3 — Polish, UX Hardening, and Analytics Enhancements (Productionizing V1)
**Goal:** Improve reliability and UX, fix edge cases, and deliver analytics beyond the MVP.

User stories:
1. As a student, I see clear messaging when I cannot start/resume an exam (inactive, max attempts reached, not invited).
2. As a creator, I can view item analysis with real per-question metrics.
3. As a system, scoring consistency is guaranteed across objective types and penalty toggles.

Steps (implemented):
- ✅ Analytics (Backend): Implemented **Item Analysis** endpoint:
  - Correct rate, skip rate, average time spent.
  - Option distribution for MCQ question types.
  - Difficulty index.
- ✅ Analytics (Frontend): Built **Item Analysis UI** under Leaders Board → Item Analysis tab.
- ✅ UX hardening: improved resilience around exam flows and state restoration.

Exit criteria:
- ✅ Item analysis dashboard displays meaningful metrics from real attempts.
- ✅ Student exam flow handles common edge cases with clear messaging.

**Phase 3 status:** ✅ Completed

---

### Phase 4 — Manual Correction + Examiner Allocation + Workload Transfer
**Goal:** Enable subjective evaluation grading workflows at scale.

User stories:
1. As an admin, I can add examiners to an evaluation with max limits and optional section filters.
2. As an admin, I can allocate pending subjective responses round-robin.
3. As an examiner, I can see my assigned responses and submit manual marks + remarks.
4. As an admin, I can transfer workload from one examiner to another (uncorrected or all).

Steps (implemented):
- ✅ Backend:
  - Examiner allocation endpoints.
  - Round-robin distribution respecting capacity/filters.
  - Examiner “my responses” listing.
  - Manual grading submission updates attempt totals.
  - Workload transfer + audit logging.
- ✅ Frontend:
  - Admin allocation/distribution/transfer UI.
  - Examiner grading UI with marks + remarks.

Exit criteria:
- ✅ Subjective grading updates totals and reflects in leaderboard.
- ✅ Allocation + distribution + transfer workflows operational end-to-end.

**Phase 4 status:** ✅ Completed

---

### Phase 5 — Proctoring (MVP) + Storage Finalization (AWS S3)
**Goal:** Add integrity controls and finalize production file storage.

User stories:
1. As a creator, I can enable proctoring for an evaluation.
2. As a student, tab-switch/minimize logs an infraction.
3. As a creator/admin, I can query and review proctoring logs per attempt.
4. As the system, file uploads (documents/audio/images) are stored in S3.

Steps (implemented):
- ✅ Proctoring:
  - Frontend focus/visibility listeners.
  - Tab-switch + window-blur event logging.
  - Backend endpoints to record events and provide summary.
- ✅ Storage:
  - Migrated from Emergent Object Storage to **AWS S3** (permissions fixed).
  - Added direct upload endpoint and **presigned upload/download** endpoints.

Exit criteria:
- ✅ Proctoring events are reliably captured and retrievable.
- ✅ S3 upload/download and presigned URL flows verified.

**Phase 5 status:** ✅ Completed

---

## 3) Next Actions (Immediate)
1. **User-requested rectifications/modifications** (next iteration):
   - Gather your change list and categorize by: backend, frontend, data model, grading logic, analytics, proctoring, storage.
   - Prioritize into: must-have, should-have, nice-to-have.
2. **Hardening / V1+ backlog (optional):**
   - Offline-first answer queue (IndexedDB/localStorage with retry/backoff) and “block submit until sync”.
   - Webcam snapshot proctoring MVP + admin review screen.
   - Guided question builders (rich UI) for complex types and validations.
   - Certificate generation workflow.

---

## 4) Success Criteria
- Phase 1: ✅ Supabase, Gemini, grading, timer validation verified with real requests.
- Phase 2: ✅ A creator can build an evaluation + questions (including AI-generated) and a student can complete an attempt successfully.
- Phase 3: ✅ Item analysis available and populated from attempts.
- Phase 4: ✅ Subjective questions can be allocated, corrected, transferred, and reflected in final scores.
- Phase 5: ✅ Proctoring events logged; file uploads stored in AWS S3.
- ✅ Final verification: **Backend 100%**, **Frontend 100%**, **Integration 100%**.