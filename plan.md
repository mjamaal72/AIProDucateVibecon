# AIProDucate — Development Plan (POC → V1 → Expand) **(Updated)**

## 1) Objectives
- Deliver a working web MVP of **AIProDucate** using **React + FastAPI + Supabase Postgres**.
- Validate and harden critical integrations: **Supabase Postgres**, **Google Gemini (Emergent key)**, and **file storage**.
- Implement production sequence modules: **Auth → Eval Mgmt → Question Bank → AI Gen → Student Exam → Leaderboard/Auto-grade → Manual Correction**.
- Enforce **Strict Creator Ownership (RBAC)** and **no stored-procedure business logic** (all in FastAPI).
- Move from “working MVP” to “production-ready V1” by polishing UX, fixing edge cases, and completing pending modules (Manual Correction, Proctoring, Offline queue).

**Status summary (as of now):**
- ✅ Phase 1 complete (Postgres + Storage + Gemini + Auto-grading + Timer validation).
- ✅ Phase 2 complete (Core app flows working: Auth, Evaluation CRUD, Question Bank, AI generation, Student Portal, Live Exam, Leaderboard).
- ▶️ Phase 3 in progress (polish + enhancements + analytics depth).
- ⏳ Phase 4 pending (Manual Correction + Examiner Allocation).
- ⏳ Phase 5 pending (Proctoring + Offline queue hardening).

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
- ✅ Implemented **file storage** via **Emergent Object Storage** (S3 keys provided but IAM PutObject was not permitted during POC; Object Storage verified working).
- ✅ Implemented **Gemini POC** using Emergent LLM key returning structured JSON.
- ✅ Implemented **auto-grading library** for objective types (SS/MS/FIB/MTF/SEQ/TOGGLE) + deterministic penalty toggles.
- ✅ Implemented **server time validation** for attempt submissions.

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
  - Attendee assignment by manual IDs + cohort resolution (schema supported).
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
- ✅ Uploads:
  - Implemented upload/download using Emergent Object Storage.

Frontend (React) (implemented):
- ✅ Auth screens: login/register.
- ✅ App shell with sidebar tabs (role-based):
  - Admin/Examiner: Evaluation Mgmt, Question Bank, Manual Correction (stub), Leaders Board, Student Portal.
  - Student: Student Portal + Leaders Board.
- ✅ Evaluation Management: cards + create/edit modal + search + toggles.
- ✅ Question Bank: evaluation selector + sections + question editor + AI generator modal.
- ✅ Student Portal: discover exams + start/resume attempt + attempts listing.
- ✅ Live Exam Runner: countdown timer, bookmark, navigation grid with legend and color coding.
- ✅ Leaders Board page.

Testing (end of Phase 2):
- ✅ Testing agent run: **Backend 94.7% success**, **Frontend 85% success**.
- ✅ Core flow verified: create eval → add section/questions → AI generate → start attempt → answer → submit → leaderboard.

**Phase 2 status:** ✅ Completed

---

### Phase 3 — Polish, UX Hardening, and Analytics Enhancements (Productionizing V1)
**Goal:** Improve reliability and UX, fix edge cases found in testing, and extend analytics beyond the MVP.

User stories:
1. As a student, I see clear messaging when I cannot start/resume an exam (inactive, max attempts reached, not invited).
2. As a creator, the Question Bank opens directly to the selected evaluation via URL params and maintains selection.
3. As a creator, I can more easily author complex question types (sequencing/matching/fill-blank) with guided builders and validation.
4. As a creator, I can view item analysis with real per-question metrics.
5. As a system, scoring consistency is guaranteed across objective types and penalty toggles.

Steps (in progress / next):
- UX fixes / edge cases:
  - Improve error handling in Live Exam and Student Portal (max attempts, inactive evaluations, submitted attempts).
  - Ensure evaluation selection persists in Question Bank via `?eval=` query param and deep links.
  - Add clearer disabled-state reasons on Start/Resume buttons.
- Question authoring UX:
  - Add per-type form builders (instead of raw HTML/textarea-only) for objective question types.
  - Add client-side validation (e.g., SINGLE_SELECT exactly 1 correct, MULTIPLE_SELECT ≥1 correct, MATCHING pairs complete, etc.).
  - Add preview mode in editor.
- Analytics:
  - Implement Item Analysis endpoints:
    - Correct rate, average time spent, skip rate, option distribution (for MCQ).
  - Build Item Analysis UI (charts + tables) under Leaders Board → Item Analysis tab.
- Code quality:
  - Add backend unit tests for grading + scoring aggregation.
  - Add basic E2E smoke tests for: auth, create eval, create question, start attempt, submit.

Exit criteria:
- Student exam flow is resilient to edge cases and surfaces user-friendly messages.
- Question authoring is guided and validates payloads.
- Item analysis dashboard displays meaningful metrics from real attempts.

**Phase 3 status:** ▶️ In progress

---

### Phase 4 — Manual Correction + Examiner Allocation + Workload Transfer
**Goal:** Enable subjective evaluation grading workflows at scale.

User stories:
1. As an admin, I can add examiners to an evaluation with max limits and optional section filters.
2. As an admin, I can allocate pending subjective responses round-robin.
3. As an examiner, I can see my assigned responses and submit manual marks + remarks.
4. As an admin, I can transfer workload from one examiner to another (uncorrected or all).
5. As an admin, I can download all attachments for an evaluation.

Steps (pending):
- Allocation engine (no stored procs):
  - Round-robin assignment respecting max limits + section filters.
  - Persist allocation + audit logs (workload_transfer_logs).
- Examiner portal views + correction submission endpoints:
  - List assigned responses, open response, view attachments, enter marks/remarks.
  - Update attempt_responses.manual_marks + corrected_at.
- Admin tools:
  - Transfer tool endpoints + UI.
  - Workload monitoring dashboards.
- Testing:
  - Allocate → correct → transfer → verify final scoring and leaderboard updates.

**Phase 4 status:** ⏳ Pending

---

### Phase 5 — Proctoring (MVP) + Offline-first queue hardening
**Goal:** Add integrity controls and robust offline-safe answer syncing.

User stories:
1. As a creator, I can enable proctoring for an evaluation.
2. As a student, tab-switch/minimize logs an infraction.
3. As a creator, I can review proctoring logs per attempt.
4. As a student, intermittent network doesn’t lose answers (queued locally).
5. As a system, submission is blocked until queued answers sync.

Steps (pending):
- Proctoring:
  - Frontend focus/visibility listeners → log events to backend.
  - Optional webcam snapshot MVP → upload → store URLs in proctoring_logs.
  - Admin review screen per attempt.
- Offline queue:
  - localStorage/IndexedDB queue for `/answer` calls with retry/backoff.
  - Sync on reconnect; prevent final submit until queue drains.
- Testing:
  - Simulate offline/online transitions.
  - Tab switch detection logs.

**Phase 5 status:** ⏳ Pending

---

## 3) Next Actions (Immediate)
1. Phase 3 polish pass:
   - Harden Student Portal + Live Exam edge cases (max attempts, inactive, already submitted).
   - Improve Question Bank deep-linking (`?eval=`) and selection persistence.
2. Implement Item Analysis endpoints + UI.
3. Add guided question builders + client-side validations.
4. Run testing agent again after Phase 3 fixes and improvements.

---

## 4) Success Criteria
- Phase 1: ✅ Supabase, storage, Gemini integrations verified with real requests; grading tests green.
- Phase 2: ✅ A creator can build an evaluation + questions (including AI-generated) and a student can complete an attempt successfully.
- Phase 3: Student/creator UX is robust; item analysis is available; authoring is guided and validated.
- Phase 4: Subjective questions can be allocated, corrected, transferred, and reflected in final scores.
- Phase 5: Proctoring events are logged; offline queue prevents data loss; submission enforces sync.
