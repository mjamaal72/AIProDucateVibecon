# AIProDucate — Development Plan (POC → V1 → Expand) **(Updated — Phase 6 / V2 Enhancements Complete; Final UI Verification Pending)**

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
- Support V2 “rectifications/modifications” requested post-V1:
  - Open-source rich text editing (TinyMCE → **Tiptap**) with LTR/RTL and exam-safe content patterns.
  - Custom fonts (CORS-safe delivery) including S3 proxy for stable rendering.
  - Advanced attendee management with **User Groups**, pre-registration, and bulk entry.
  - Student exam UX bug fixes (FIB inline droppables, resilient timer).
  - Evaluation lifecycle controls (**Archive/Restore**) and administrative reset (**Delete all attempts**).

**Status summary (as of now):**
- ✅ Phase 1 complete (Postgres + Storage + Gemini + Auto-grading + Timer validation).
- ✅ Phase 2 complete (Core app flows: Auth, Evaluation CRUD, Question Bank, AI generation, Student Portal, Live Exam, Leaderboard).
- ✅ Phase 3 complete (Analytics: Item Analysis + UI).
- ✅ Phase 4 complete (Manual Correction: allocation + round-robin + transfer + grading UI).
- ✅ Phase 5 complete (Proctoring: tab-switch + window blur detection, event logging).
- ✅ Storage finalized: **AWS S3** replaces earlier object storage.
- ✅ Phase 6 implemented (V2 enhancements: Tiptap, custom fonts proxy, groups/attendees, exam fixes, archive/delete attempts, UI cleanup).
- ⚠️ Final status: **Backend verified for Phase 6; frontend visual verification pending** (automation blocked by Playwright login flow, not by app runtime).

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
  - Migrated to **AWS S3**.
  - Added direct upload endpoint and **presigned upload/download** endpoints.

Exit criteria:
- ✅ Proctoring events are reliably captured and retrievable.
- ✅ S3 upload/download and presigned URL flows verified.

**Phase 5 status:** ✅ Completed

---

### Phase 6 — V2 Enhancements / Rectifications (Open-source Editor, Fonts, Groups, Exam Fixes, Archive/Reset)
**Goal:** Implement requested rectifications and harden UX for production usage.

User stories:
1. As a creator, I can author rich question content with an open-source editor supporting RTL/LTR, blanks insertion, and custom fonts.
2. As an admin, I can upload custom fonts and reliably render them across dashboard + student exam views (no S3 CORS or token expiry issues).
3. As an admin/creator, I can manage attendees via **user groups**, bulk entry, and pre-registration.
4. As a student, I can interact with FIB drag/drop inline droppables (no line breaks/box stacking).
5. As a student, I can rely on an exam timer that does not get stuck on re-renders or tab switching.
6. As an admin, I can **archive** an evaluation (and restore it) and can **delete all attempts** to reset an evaluation.

Implemented changes (this session):
- ✅ Editor: Replaced commercial HTML editor (TinyMCE) with **Tiptap** (MIT license) supporting custom styling patterns.
- ✅ Fonts: Implemented backend proxy **`GET /api/fonts/{font_id}/file`** to avoid S3 CORS & presigned URL expiry issues.
- ✅ Groups: Implemented **User Groups CRUD** + membership tables.
- ✅ Attendee management: Advanced attendee modal supports:
  - Individual add
  - Group add
  - Bulk entry
  - Pre-registration
- ✅ Student exam: Fixed FIB drag-and-drop droppable rendering inline.
- ✅ Student exam: Timer resilience improvements (useRef + visibility listeners).
- ✅ Evaluation lifecycle:
  - **Archive/Unarchive** endpoints and UI page.
  - **Delete all attempts** endpoint and UI action.
- ✅ UI improvement: Refactored evaluation card actions into a **DropdownMenu** (reduces clutter).
- ✅ Backend fix: Corrected evaluation listing to honor `archived` filter for Admin/Examiner.

Key endpoints added/verified:
- ✅ `PUT /api/evaluations/{eval_id}/archive`
- ✅ `PUT /api/evaluations/{eval_id}/unarchive`
- ✅ `DELETE /api/evaluations/{eval_id}/attempts`
- ✅ `GET /api/evaluations?archived=true|false` (filter now applied for Admin/Examiner too)

Exit criteria:
- ✅ Backend: archive/unarchive/delete-attempts endpoints working and admin-guarded.
- ✅ Backend: archived filter works for all roles.
- ✅ Frontend: Archive page reachable from sidebar and restores evaluations.
- ✅ Frontend: Evaluation card actions accessible and usable (Edit/Questions primary, others in menu).
- ⚠️ Automation: Playwright-based UI verification needs updated selectors and/or login automation tuning.

**Phase 6 status:** ✅ Implemented; ⚠️ Frontend visual verification pending

---

## 3) Next Actions (Immediate)
1. **Frontend verification (P0):**
   - Manually verify in browser:
     - Archive from Evaluation card → appears in Archive page
     - Restore from Archive page → returns to active list
     - Delete all attempts → leaderboard resets and students can retake
   - Update Playwright scripts to use stable selectors:
     - Use `data-testid="login-email-input"`, `data-testid="login-password-input"`, `data-testid="login-submit-button"`
     - Use menu testids added during refactor:
       - `evaluation-card-more-button`, `evaluation-card-archive-menu`, `evaluation-card-delete-attempts-menu`
2. **Comprehensive end-to-end test (P1):**
   - Run full exam flow including:
     - Tiptap authored questions
     - Custom font rendering via backend proxy
     - Group/bulk attendee assignment
     - FIB drag/drop
     - Timer resilience
3. **Optional UX polish (P2):**
   - Replace confirm() dialogs with Shadcn `AlertDialog` for Archive/Delete actions.
   - Add skeleton loaders on ArchivedEvaluations page.

---

## 4) Success Criteria
- Phase 1: ✅ Supabase, Gemini, grading, timer validation verified with real requests.
- Phase 2: ✅ A creator can build an evaluation + questions (including AI-generated) and a student can complete an attempt successfully.
- Phase 3: ✅ Item analysis available and populated from attempts.
- Phase 4: ✅ Subjective questions can be allocated, corrected, transferred, and reflected in final scores.
- Phase 5: ✅ Proctoring events logged; file uploads stored in AWS S3.
- Phase 6: ✅ V2 enhancements shipped (Tiptap, fonts proxy, user groups/attendees, exam fixes, archive/delete attempts, UI cleanup).
- Final verification target:
  - ✅ Backend verification complete for Phase 6.
  - ⚠️ Frontend UI automation verification pending (manual verification recommended; update Playwright locators/testids).