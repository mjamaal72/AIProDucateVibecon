from sqlalchemy import Column, String, Integer, BigInteger, Boolean, Text, DECIMAL, TIMESTAMP, ForeignKey, ARRAY, Enum as SAEnum, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import declarative_base, relationship
import enum

Base = declarative_base()

class QuestionTypeEnum(str, enum.Enum):
    SINGLE_SELECT = 'SINGLE_SELECT'
    MULTIPLE_SELECT = 'MULTIPLE_SELECT'
    FILL_BLANK = 'FILL_BLANK'
    MATCHING = 'MATCHING'
    SEQUENCING = 'SEQUENCING'
    TOGGLE_BINARY = 'TOGGLE_BINARY'
    SUBJECTIVE_TYPING = 'SUBJECTIVE_TYPING'
    FILE_UPLOAD = 'FILE_UPLOAD'
    AUDIO_RECORDING = 'AUDIO_RECORDING'

class UserRoleEnum(str, enum.Enum):
    ADMIN = 'ADMIN'
    EXAMINER = 'EXAMINER'
    STUDENT = 'STUDENT'

class User(Base):
    __tablename__ = 'users'
    user_id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    unique_identifier = Column(String(50), unique=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True)
    password_hash = Column(String(255))
    role = Column(SAEnum('ADMIN', 'EXAMINER', 'STUDENT', name='user_role_enum', create_type=False), default='STUDENT')
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    is_active = Column(Boolean, default=True)

class CohortGroup(Base):
    __tablename__ = 'cohort_groups'
    cohort_id = Column(Integer, primary_key=True, autoincrement=True)
    branch_name = Column(String(255))
    grade_level = Column(String(50))
    section = Column(String(50))
    demographic_filter = Column(String(50))
    description = Column(Text)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("CURRENT_TIMESTAMP"))

class UserCohortMembership(Base):
    __tablename__ = 'user_cohort_memberships'
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), primary_key=True)
    cohort_id = Column(Integer, ForeignKey('cohort_groups.cohort_id', ondelete='CASCADE'), primary_key=True)

class Evaluation(Base):
    __tablename__ = 'evaluations'
    eval_id = Column(Integer, primary_key=True, autoincrement=True)
    eval_title = Column(String(255), nullable=False)
    duration_minutes = Column(Integer, nullable=False, default=60)
    max_attempts = Column(Integer, nullable=False, default=1)
    start_time = Column(TIMESTAMP(timezone=True), nullable=False)
    end_time = Column(TIMESTAMP(timezone=True))
    is_active = Column(Boolean, default=True)
    visibility = Column(String(50), default='INVITE_ONLY')
    shuffle_categories = Column(Boolean, default=False)
    shuffle_questions = Column(Boolean, default=False)
    enable_proctoring = Column(Boolean, default=False)
    show_instant_results = Column(Boolean, default=False)
    allow_navigation = Column(Boolean, default=True)
    passing_percentage = Column(DECIMAL(5, 2))
    is_locked_for_editing = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.user_id'))
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text("CURRENT_TIMESTAMP"))

class EvaluationAttendee(Base):
    __tablename__ = 'evaluation_attendees'
    eval_id = Column(Integer, ForeignKey('evaluations.eval_id', ondelete='CASCADE'), primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), primary_key=True)
    added_via_cohort_id = Column(Integer, ForeignKey('cohort_groups.cohort_id', ondelete='SET NULL'))

class EvaluationSection(Base):
    __tablename__ = 'evaluation_sections'
    section_id = Column(Integer, primary_key=True, autoincrement=True)
    eval_id = Column(Integer, ForeignKey('evaluations.eval_id', ondelete='CASCADE'))
    section_name = Column(String(500), nullable=False)
    target_question_count = Column(Integer, default=0)
    target_total_marks = Column(DECIMAL(10, 2), default=0.00)
    instructions = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("CURRENT_TIMESTAMP"))

class Question(Base):
    __tablename__ = 'questions'
    question_id = Column(BigInteger, primary_key=True, autoincrement=True)
    eval_id = Column(Integer, ForeignKey('evaluations.eval_id', ondelete='CASCADE'))
    section_id = Column(Integer, ForeignKey('evaluation_sections.section_id', ondelete='SET NULL'))
    question_type = Column(SAEnum('SINGLE_SELECT', 'MULTIPLE_SELECT', 'FILL_BLANK', 'MATCHING', 'SEQUENCING', 'TOGGLE_BINARY', 'SUBJECTIVE_TYPING', 'FILE_UPLOAD', 'AUDIO_RECORDING', name='question_type_enum', create_type=False), nullable=False)
    content_html = Column(Text, nullable=False)
    multimedia_url = Column(Text)
    marks = Column(DECIMAL(10, 2), nullable=False, default=1.00)
    negative_marks = Column(DECIMAL(10, 2), default=0.00)
    time_limit_seconds = Column(Integer)
    word_limit = Column(Integer)
    penalty_logic_type = Column(String(50), default='NONE')
    ui_styling_config = Column(JSONB)
    is_active = Column(Boolean, default=True)
    added_by = Column(UUID(as_uuid=True), ForeignKey('users.user_id'))
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    options = relationship('QuestionOption', backref='question', lazy='selectin', cascade='all, delete-orphan')

class QuestionOption(Base):
    __tablename__ = 'question_options'
    option_id = Column(BigInteger, primary_key=True, autoincrement=True)
    question_id = Column(BigInteger, ForeignKey('questions.question_id', ondelete='CASCADE'))
    content_left = Column(Text)
    content_right = Column(Text)
    is_correct = Column(Boolean, default=False)
    display_sequence = Column(Integer, default=0)
    partial_marks = Column(DECIMAL(10, 2))
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("CURRENT_TIMESTAMP"))

class EvaluationAttempt(Base):
    __tablename__ = 'evaluation_attempts'
    attempt_id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    eval_id = Column(Integer, ForeignKey('evaluations.eval_id', ondelete='CASCADE'))
    candidate_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'))
    started_at = Column(TIMESTAMP(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    submitted_at = Column(TIMESTAMP(timezone=True))
    status = Column(String(50), default='IN_PROGRESS')
    total_score = Column(DECIMAL(10, 2))
    is_passed = Column(Boolean)
    certificate_issued_url = Column(Text)

class AttemptResponse(Base):
    __tablename__ = 'attempt_responses'
    response_id = Column(BigInteger, primary_key=True, autoincrement=True)
    attempt_id = Column(UUID(as_uuid=True), ForeignKey('evaluation_attempts.attempt_id', ondelete='CASCADE'))
    question_id = Column(BigInteger, ForeignKey('questions.question_id'))
    candidate_response_payload = Column(Text)
    cloud_attachment_urls = Column(ARRAY(Text))
    display_sequence = Column(Integer, default=0)
    is_viewed = Column(Boolean, default=False)
    is_bookmarked = Column(Boolean, default=False)
    time_spent_seconds = Column(Integer, default=0)
    question_started_at = Column(TIMESTAMP(timezone=True))
    auto_graded_marks = Column(DECIMAL(10, 2))
    is_flagged_for_review = Column(Boolean, default=False)
    manual_marks = Column(DECIMAL(10, 2))
    assigned_examiner_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id'))
    corrected_at = Column(TIMESTAMP(timezone=True))
    examiner_remarks = Column(Text)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text("CURRENT_TIMESTAMP"))

class ExaminerAllocation(Base):
    __tablename__ = 'examiner_allocations'
    allocation_id = Column(Integer, primary_key=True, autoincrement=True)
    eval_id = Column(Integer, ForeignKey('evaluations.eval_id', ondelete='CASCADE'))
    examiner_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id'))
    max_assignment_limit = Column(Integer)
    section_filter_id = Column(Integer, ForeignKey('evaluation_sections.section_id'))
    allocated_at = Column(TIMESTAMP(timezone=True), server_default=text("CURRENT_TIMESTAMP"))

class WorkloadTransferLog(Base):
    __tablename__ = 'workload_transfer_logs'
    transfer_id = Column(Integer, primary_key=True, autoincrement=True)
    eval_id = Column(Integer, ForeignKey('evaluations.eval_id', ondelete='CASCADE'))
    source_examiner_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id'))
    destination_examiner_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id'))
    questions_transferred = Column(Integer, nullable=False)
    section_filter_id = Column(Integer, ForeignKey('evaluation_sections.section_id'))
    only_uncorrected = Column(Boolean, default=True)
    transferred_at = Column(TIMESTAMP(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    transferred_by = Column(UUID(as_uuid=True), ForeignKey('users.user_id'))

class AIGenerationLog(Base):
    __tablename__ = 'ai_generation_logs'
    log_id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
    eval_id = Column(Integer, ForeignKey('evaluations.eval_id', ondelete='SET NULL'))
    requested_by = Column(UUID(as_uuid=True), ForeignKey('users.user_id'))
    source_context = Column(Text, nullable=False)
    target_section_id = Column(Integer, ForeignKey('evaluation_sections.section_id'))
    requested_question_type = Column(SAEnum('SINGLE_SELECT', 'MULTIPLE_SELECT', 'FILL_BLANK', 'MATCHING', 'SEQUENCING', 'TOGGLE_BINARY', 'SUBJECTIVE_TYPING', 'FILE_UPLOAD', 'AUDIO_RECORDING', name='question_type_enum', create_type=False))
    requested_count = Column(Integer)
    generated_payload = Column(JSONB, nullable=False)
    questions_saved_count = Column(Integer, default=0)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("CURRENT_TIMESTAMP"))

class ProctoringLog(Base):
    __tablename__ = 'proctoring_logs'
    log_id = Column(BigInteger, primary_key=True, autoincrement=True)
    attempt_id = Column(UUID(as_uuid=True), ForeignKey('evaluation_attempts.attempt_id', ondelete='CASCADE'))
    event_type = Column(String(50), nullable=False)
    event_timestamp = Column(TIMESTAMP(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    snapshot_url = Column(Text)
    description = Column(Text)


class CustomFont(Base):
    __tablename__ = 'custom_fonts'
    font_id = Column(Integer, primary_key=True, autoincrement=True)
    font_name = Column(String(255), unique=True, nullable=False)
    font_file_url = Column(Text, nullable=False)
    font_format = Column(String(50), default='truetype')
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey('users.user_id'))
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("CURRENT_TIMESTAMP"))

class PreRegisteredAttendee(Base):
    __tablename__ = 'pre_registered_attendees'
    id = Column(Integer, primary_key=True, autoincrement=True)
    eval_id = Column(Integer, ForeignKey('evaluations.eval_id', ondelete='CASCADE'))
    email = Column(String(255), nullable=False)
    unique_identifier = Column(String(255))
    added_at = Column(TIMESTAMP(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    resolved = Column(Boolean, default=False)

class UserGroup(Base):
    __tablename__ = 'user_groups'
    group_id = Column(Integer, primary_key=True, autoincrement=True)
    group_name = Column(String(255), unique=True, nullable=False)
    description = Column(Text)
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.user_id'))
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("CURRENT_TIMESTAMP"))

class UserGroupMember(Base):
    __tablename__ = 'user_group_members'
    group_id = Column(Integer, ForeignKey('user_groups.group_id', ondelete='CASCADE'), primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), primary_key=True)
    added_at = Column(TIMESTAMP(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
