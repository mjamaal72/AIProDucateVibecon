"""
AIProDucate Core POC Test Script
Tests: PostgreSQL, S3, Gemini LLM, Auto-Grading Engine, Server-Time Validation
All integrations in one file.
"""
import asyncio
import os
import json
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / '.env')

# ========== TEST 1: PostgreSQL (Supabase) Connection ==========
async def test_postgres_connection():
    print("\n" + "="*60)
    print("TEST 1: PostgreSQL (Supabase) Connection")
    print("="*60)
    try:
        from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
        from sqlalchemy import text
        
        db_url = os.environ.get('DATABASE_URL')
        async_url = db_url.replace('postgresql://', 'postgresql+asyncpg://')
        
        engine = create_async_engine(
            async_url,
            pool_size=5,
            connect_args={"statement_cache_size": 0, "command_timeout": 30}
        )
        
        async with engine.connect() as conn:
            # Test basic query
            result = await conn.execute(text("SELECT current_timestamp, current_database()"))
            row = result.fetchone()
            print(f"  Connected! Timestamp: {row[0]}, Database: {row[1]}")
            
            # Test reading from users table
            result = await conn.execute(text("SELECT COUNT(*) FROM users"))
            count = result.scalar()
            print(f"  Users table accessible. Row count: {count}")
            
            # Test reading evaluations table
            result = await conn.execute(text("SELECT COUNT(*) FROM evaluations"))
            count = result.scalar()
            print(f"  Evaluations table accessible. Row count: {count}")
            
            # Test writing a user and then deleting it
            test_id = str(uuid.uuid4())
            await conn.execute(
                text("INSERT INTO users (user_id, unique_identifier, full_name, email, role) VALUES (:uid, :ident, :name, :email, 'ADMIN')"),
                {"uid": test_id, "ident": f"test_{test_id[:8]}", "name": "POC Test User", "email": f"poc_{test_id[:8]}@test.com"}
            )
            await conn.commit()
            print(f"  Write test: Inserted user {test_id[:8]}")
            
            # Read it back
            result = await conn.execute(text("SELECT full_name FROM users WHERE user_id = :uid"), {"uid": test_id})
            row = result.fetchone()
            print(f"  Read test: Found user '{row[0]}'")
            
            # Clean up
            await conn.execute(text("DELETE FROM users WHERE user_id = :uid"), {"uid": test_id})
            await conn.commit()
            print(f"  Cleanup: Deleted test user")
        
        await engine.dispose()
        print("  ✅ PostgreSQL connection test PASSED")
        return True
    except Exception as e:
        print(f"  ❌ PostgreSQL test FAILED: {e}")
        import traceback; traceback.print_exc()
        return False


# ========== TEST 2: AWS S3 Upload/Download ==========
async def test_s3_operations():
    print("\n" + "="*60)
    print("TEST 2: AWS S3 Presigned Upload/Download")
    print("="*60)
    try:
        import boto3
        from botocore.config import Config
        
        s3_client = boto3.client(
            's3',
            aws_access_key_id=os.environ.get('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY'),
            region_name=os.environ.get('AWS_REGION', 'ap-south-1'),
            config=Config(signature_version='s3v4')
        )
        bucket = os.environ.get('AWS_S3_BUCKET', 'aiproducate')
        
        # Test 1: Generate presigned PUT URL
        test_key = f"poc-test/{uuid.uuid4()}.txt"
        put_url = s3_client.generate_presigned_url(
            'put_object',
            Params={'Bucket': bucket, 'Key': test_key, 'ContentType': 'text/plain'},
            ExpiresIn=300
        )
        print(f"  Generated presigned PUT URL: {put_url[:80]}...")
        
        # Test 2: Upload directly using boto3
        test_content = b"AIProDucate POC Test File - " + str(datetime.now(timezone.utc)).encode()
        s3_client.put_object(
            Bucket=bucket,
            Key=test_key,
            Body=test_content,
            ContentType='text/plain'
        )
        print(f"  Uploaded test file: {test_key}")
        
        # Test 3: Generate presigned GET URL
        get_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket, 'Key': test_key},
            ExpiresIn=300
        )
        print(f"  Generated presigned GET URL: {get_url[:80]}...")
        
        # Test 4: Download and verify
        response = s3_client.get_object(Bucket=bucket, Key=test_key)
        downloaded = response['Body'].read()
        assert downloaded == test_content, "Downloaded content doesn't match!"
        print(f"  Downloaded and verified content matches")
        
        # Cleanup
        s3_client.delete_object(Bucket=bucket, Key=test_key)
        print(f"  Cleanup: Deleted test file")
        
        print("  ✅ S3 operations test PASSED")
        return True
    except Exception as e:
        print(f"  ❌ S3 test FAILED: {e}")
        import traceback; traceback.print_exc()
        return False


# ========== TEST 3: Google Gemini AI Question Generation ==========
async def test_gemini_generation():
    print("\n" + "="*60)
    print("TEST 3: Google Gemini AI Question Generation")
    print("="*60)
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"poc-test-{uuid.uuid4()}",
            system_message="""You are an AI question generator for educational evaluations. 
Generate questions in valid JSON format. Return ONLY a JSON array, no markdown formatting."""
        ).with_model("gemini", "gemini-2.5-flash")
        
        prompt = """Generate exactly 2 questions about "Photosynthesis" in the following JSON format:
[
  {
    "question_type": "SINGLE_SELECT",
    "content_html": "<p>Question text here</p>",
    "marks": 2,
    "options": [
      {"content_left": "Option A", "is_correct": true},
      {"content_left": "Option B", "is_correct": false},
      {"content_left": "Option C", "is_correct": false},
      {"content_left": "Option D", "is_correct": false}
    ]
  }
]
Return ONLY the JSON array, no explanation."""

        message = UserMessage(text=prompt)
        response = await chat.send_message(message)
        
        print(f"  Raw response length: {len(response)} chars")
        
        # Try to parse JSON
        clean_resp = response.strip()
        if clean_resp.startswith("```"):
            clean_resp = clean_resp.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        
        questions = json.loads(clean_resp)
        print(f"  Parsed {len(questions)} questions:")
        for i, q in enumerate(questions):
            print(f"    Q{i+1}: Type={q.get('question_type')}, Marks={q.get('marks')}")
            print(f"         Content: {q.get('content_html', '')[:60]}...")
            print(f"         Options: {len(q.get('options', []))}")
        
        assert len(questions) >= 1, "Should generate at least 1 question"
        print("  ✅ Gemini AI generation test PASSED")
        return True
    except Exception as e:
        print(f"  ❌ Gemini test FAILED: {e}")
        import traceback; traceback.print_exc()
        return False


# ========== TEST 4: Auto-Grading Engine ==========
def test_auto_grading():
    print("\n" + "="*60)
    print("TEST 4: Auto-Grading Engine (All Question Types)")
    print("="*60)
    
    all_passed = True
    
    # --- Single Select ---
    print("\n  [Single Select]")
    # Correct answer
    score = grade_single_select(
        correct_option_id=1,
        selected_option_id=1,
        marks=5.0,
        negative_marks=1.0
    )
    assert score == 5.0, f"Expected 5.0, got {score}"
    print(f"    Correct answer: {score}/5.0 ✓")
    
    # Wrong answer with negative marks
    score = grade_single_select(
        correct_option_id=1,
        selected_option_id=2,
        marks=5.0,
        negative_marks=1.0
    )
    assert score == -1.0, f"Expected -1.0, got {score}"
    print(f"    Wrong answer: {score} (negative marking) ✓")
    
    # --- Multiple Select with Toggle A (Sniper) ---
    print("\n  [Multiple Select - Toggle A (Sniper)]")
    score = grade_multiple_select(
        correct_ids={1, 2, 3},
        selected_ids={1, 2, 3},
        marks_per_correct=2.0,
        penalty_toggle='A'
    )
    assert score == 6.0, f"Expected 6.0, got {score}"
    print(f"    All correct: {score}/6.0 ✓")
    
    score = grade_multiple_select(
        correct_ids={1, 2, 3},
        selected_ids={1, 2, 4},  # 4 is wrong
        marks_per_correct=2.0,
        penalty_toggle='A'
    )
    assert score == 0.0, f"Expected 0.0, got {score}"
    print(f"    Any wrong = 0: {score} ✓")
    
    # --- Multiple Select with Toggle B (Offset) ---
    print("\n  [Multiple Select - Toggle B (Offset)]")
    score = grade_multiple_select(
        correct_ids={1, 2, 3},
        selected_ids={1, 2, 4},  # 2 correct, 1 wrong
        marks_per_correct=2.0,
        penalty_toggle='B'
    )
    assert score == 2.0, f"Expected 2.0, got {score}"  # 2*2 - 1*2 = 2
    print(f"    2 correct, 1 wrong: {score} (offset) ✓")
    
    # --- Multiple Select with Toggle C (Pure Partial) ---
    print("\n  [Multiple Select - Toggle C (Pure Partial)]")
    score = grade_multiple_select(
        correct_ids={1, 2, 3},
        selected_ids={1, 4},  # 1 correct, 1 wrong
        marks_per_correct=2.0,
        penalty_toggle='C'
    )
    assert score == 2.0, f"Expected 2.0, got {score}"  # only correct earn marks
    print(f"    1 correct, 1 wrong: {score} (pure partial) ✓")
    
    # --- Fill In The Blank ---
    print("\n  [Fill In The Blank]")
    score = grade_fill_blank(
        correct_answers={0: "photosynthesis", 1: "chlorophyll"},
        student_answers={0: "photosynthesis", 1: "chlorophyll"},
        marks_per_blank=2.0,
        penalty_toggle='C'
    )
    assert score == 4.0, f"Expected 4.0, got {score}"
    print(f"    All blanks correct: {score}/4.0 ✓")
    
    score = grade_fill_blank(
        correct_answers={0: "photosynthesis", 1: "chlorophyll"},
        student_answers={0: "photosynthesis", 1: "wrong"},
        marks_per_blank=2.0,
        penalty_toggle='A'
    )
    assert score == 0.0, f"Expected 0.0, got {score}"
    print(f"    Toggle A (1 wrong = 0): {score} ✓")
    
    # --- Match The Following ---
    print("\n  [Match The Following]")
    score = grade_matching(
        correct_pairs={1: 'A', 2: 'B', 3: 'C'},
        student_pairs={1: 'A', 2: 'B', 3: 'C'},
        marks_per_pair=2.0,
        penalty_toggle='C'
    )
    assert score == 6.0, f"Expected 6.0, got {score}"
    print(f"    All pairs correct: {score}/6.0 ✓")
    
    score = grade_matching(
        correct_pairs={1: 'A', 2: 'B', 3: 'C'},
        student_pairs={1: 'A', 2: 'C', 3: 'B'},  # 1 correct, 2 wrong
        marks_per_pair=2.0,
        penalty_toggle='B'
    )
    assert score == 0.0, f"Expected 0.0, got {score}"  # 1*2 - 2*2 = -2 → max(0, -2) = 0
    print(f"    Toggle B (1 correct, 2 wrong): {score} ✓")
    
    # --- Sequencing (Absolute Position) ---
    print("\n  [Sequencing - Absolute Position]")
    score = grade_sequence_absolute(
        correct_order=[1, 2, 3, 4],
        student_order=[1, 2, 3, 4],
        marks_per_position=1.0,
        penalty_toggle='C'
    )
    assert score == 4.0, f"Expected 4.0, got {score}"
    print(f"    Perfect order: {score}/4.0 ✓")
    
    score = grade_sequence_absolute(
        correct_order=[1, 2, 3, 4],
        student_order=[1, 3, 2, 4],  # 2 correct positions
        marks_per_position=1.0,
        penalty_toggle='C'
    )
    assert score == 2.0, f"Expected 2.0, got {score}"
    print(f"    2 correct positions: {score}/4.0 ✓")
    
    # --- Sequencing (Relative Continuity) ---
    print("\n  [Sequencing - Relative Continuity]")
    score = grade_sequence_relative(
        correct_order=[1, 2, 3, 4],
        student_order=[1, 2, 3, 4],
        marks_per_link=1.0,
        penalty_toggle='C'
    )
    assert score == 3.0, f"Expected 3.0, got {score}"  # 3 correct links
    print(f"    Perfect chain: {score}/3.0 ✓")
    
    score = grade_sequence_relative(
        correct_order=[1, 2, 3, 4],
        student_order=[2, 1, 3, 4],  # link 1->3: no, 3->4: yes = 1 correct link
        marks_per_link=1.0,
        penalty_toggle='C'
    )
    # Correct consecutive pairs in correct_order: (1,2), (2,3), (3,4)
    # Student: 2,1,3,4 → consecutive pairs: (2,1), (1,3), (3,4)
    # Only (3,4) matches → 1 link correct
    assert score == 1.0, f"Expected 1.0, got {score}"
    print(f"    1 correct link: {score}/3.0 ✓")
    
    # --- Toggle Binary ---
    print("\n  [Toggle Binary]")
    score = grade_toggle_binary(
        correct_values={1: True, 2: False, 3: True},
        student_values={1: True, 2: False, 3: True},
        marks_per_toggle=1.0,
        penalty_toggle='C'
    )
    assert score == 3.0, f"Expected 3.0, got {score}"
    print(f"    All correct: {score}/3.0 ✓")
    
    score = grade_toggle_binary(
        correct_values={1: True, 2: False, 3: True},
        student_values={1: True, 2: True, 3: False},  # 1 correct, 2 wrong
        marks_per_toggle=1.0,
        penalty_toggle='A'
    )
    assert score == 0.0, f"Expected 0.0, got {score}"
    print(f"    Toggle A (any wrong = 0): {score} ✓")
    
    print("\n  ✅ Auto-grading engine test PASSED")
    return True


# ========== Grading Functions ==========

def grade_single_select(correct_option_id, selected_option_id, marks, negative_marks=0):
    """Grade a single select question."""
    if selected_option_id is None:
        return 0.0
    if selected_option_id == correct_option_id:
        return float(marks)
    return float(-negative_marks) if negative_marks else 0.0


def grade_multiple_select(correct_ids: set, selected_ids: set, marks_per_correct: float, penalty_toggle: str):
    """Grade multiple select with penalty toggles A/B/C."""
    if not selected_ids:
        return 0.0
    
    correct_selected = selected_ids & correct_ids
    incorrect_selected = selected_ids - correct_ids
    
    if penalty_toggle == 'A':  # Sniper: any wrong = 0
        if incorrect_selected:
            return 0.0
        return len(correct_selected) * marks_per_correct
    
    elif penalty_toggle == 'B':  # Offset: correct - incorrect
        score = (len(correct_selected) - len(incorrect_selected)) * marks_per_correct
        return max(0.0, score)
    
    elif penalty_toggle == 'C':  # Pure Partial: correct earn, wrong = 0
        return len(correct_selected) * marks_per_correct
    
    # Default: all or nothing
    if selected_ids == correct_ids:
        return len(correct_ids) * marks_per_correct
    return 0.0


def grade_fill_blank(correct_answers: dict, student_answers: dict, marks_per_blank: float, penalty_toggle: str):
    """Grade fill-in-the-blank with penalty toggles."""
    if not student_answers:
        return 0.0
    
    correct_count = 0
    incorrect_count = 0
    
    for blank_idx, correct_val in correct_answers.items():
        student_val = student_answers.get(blank_idx, "")
        if str(student_val).strip().lower() == str(correct_val).strip().lower():
            correct_count += 1
        else:
            incorrect_count += 1
    
    if penalty_toggle == 'A':
        return 0.0 if incorrect_count > 0 else correct_count * marks_per_blank
    elif penalty_toggle == 'B':
        return max(0.0, (correct_count - incorrect_count) * marks_per_blank)
    elif penalty_toggle == 'C':
        return correct_count * marks_per_blank
    
    # All or nothing
    return correct_count * marks_per_blank if incorrect_count == 0 else 0.0


def grade_matching(correct_pairs: dict, student_pairs: dict, marks_per_pair: float, penalty_toggle: str):
    """Grade match-the-following with penalty toggles."""
    if not student_pairs:
        return 0.0
    
    correct_count = 0
    incorrect_count = 0
    
    for left_id, correct_right in correct_pairs.items():
        student_right = student_pairs.get(left_id)
        if student_right == correct_right:
            correct_count += 1
        elif student_right is not None:
            incorrect_count += 1
    
    if penalty_toggle == 'A':
        return 0.0 if incorrect_count > 0 else correct_count * marks_per_pair
    elif penalty_toggle == 'B':
        return max(0.0, (correct_count - incorrect_count) * marks_per_pair)
    elif penalty_toggle == 'C':
        return correct_count * marks_per_pair
    
    return correct_count * marks_per_pair if incorrect_count == 0 else 0.0


def grade_sequence_absolute(correct_order: list, student_order: list, marks_per_position: float, penalty_toggle: str):
    """Grade sequencing with absolute position matching."""
    if not student_order:
        return 0.0
    
    correct_count = 0
    incorrect_count = 0
    
    for i, item in enumerate(student_order):
        if i < len(correct_order) and item == correct_order[i]:
            correct_count += 1
        else:
            incorrect_count += 1
    
    if penalty_toggle == 'A':
        return 0.0 if incorrect_count > 0 else correct_count * marks_per_position
    elif penalty_toggle == 'B':
        return max(0.0, (correct_count - incorrect_count) * marks_per_position)
    elif penalty_toggle == 'C':
        return correct_count * marks_per_position
    
    return correct_count * marks_per_position if incorrect_count == 0 else 0.0


def grade_sequence_relative(correct_order: list, student_order: list, marks_per_link: float, penalty_toggle: str):
    """Grade sequencing with relative continuity (chain links)."""
    if len(student_order) < 2:
        return 0.0
    
    # Build correct consecutive pairs
    correct_links = set()
    for i in range(len(correct_order) - 1):
        correct_links.add((correct_order[i], correct_order[i + 1]))
    
    # Check student's consecutive pairs
    correct_count = 0
    incorrect_count = 0
    for i in range(len(student_order) - 1):
        pair = (student_order[i], student_order[i + 1])
        if pair in correct_links:
            correct_count += 1
        else:
            incorrect_count += 1
    
    if penalty_toggle == 'A':
        return 0.0 if incorrect_count > 0 else correct_count * marks_per_link
    elif penalty_toggle == 'B':
        return max(0.0, (correct_count - incorrect_count) * marks_per_link)
    elif penalty_toggle == 'C':
        return correct_count * marks_per_link
    
    return correct_count * marks_per_link if incorrect_count == 0 else 0.0


def grade_toggle_binary(correct_values: dict, student_values: dict, marks_per_toggle: float, penalty_toggle: str):
    """Grade toggle binary (multi-statement) with penalty toggles."""
    if not student_values:
        return 0.0
    
    correct_count = 0
    incorrect_count = 0
    
    for stmt_id, correct_val in correct_values.items():
        student_val = student_values.get(stmt_id)
        if student_val == correct_val:
            correct_count += 1
        elif student_val is not None:
            incorrect_count += 1
    
    if penalty_toggle == 'A':
        return 0.0 if incorrect_count > 0 else correct_count * marks_per_toggle
    elif penalty_toggle == 'B':
        return max(0.0, (correct_count - incorrect_count) * marks_per_toggle)
    elif penalty_toggle == 'C':
        return correct_count * marks_per_toggle
    
    return correct_count * marks_per_toggle if incorrect_count == 0 else 0.0


# ========== TEST 5: Server-Side Time Validation ==========
def test_time_validation():
    print("\n" + "="*60)
    print("TEST 5: Server-Side Time Validation")
    print("="*60)
    
    # Test 1: Valid submission within time
    started_at = datetime.now(timezone.utc) - timedelta(minutes=30)
    duration_minutes = 60
    current_time = datetime.now(timezone.utc)
    
    is_valid = validate_exam_time(started_at, duration_minutes, current_time)
    assert is_valid == True, "Should be valid - 30 min into 60 min exam"
    print(f"  30min into 60min exam: Valid={is_valid} ✓")
    
    # Test 2: Expired submission
    started_at = datetime.now(timezone.utc) - timedelta(minutes=90)
    is_valid = validate_exam_time(started_at, duration_minutes, current_time)
    assert is_valid == False, "Should be invalid - 90 min into 60 min exam"
    print(f"  90min into 60min exam: Valid={is_valid} ✓")
    
    # Test 3: Question timer validation
    question_started_at = datetime.now(timezone.utc) - timedelta(seconds=25)
    time_limit = 30  # seconds
    is_valid = validate_question_time(question_started_at, time_limit, current_time)
    assert is_valid == True, "Should be valid - 25s into 30s timer"
    print(f"  25s into 30s question timer: Valid={is_valid} ✓")
    
    # Test 4: Expired question timer
    question_started_at = datetime.now(timezone.utc) - timedelta(seconds=35)
    is_valid = validate_question_time(question_started_at, time_limit, current_time)
    assert is_valid == False, "Should be invalid - 35s into 30s timer"
    print(f"  35s into 30s question timer: Valid={is_valid} ✓")
    
    print("  ✅ Server-side time validation test PASSED")
    return True


def validate_exam_time(started_at, duration_minutes, current_time):
    """Validate if an exam submission is within allowed time window."""
    deadline = started_at + timedelta(minutes=duration_minutes)
    return current_time <= deadline


def validate_question_time(question_started_at, time_limit_seconds, current_time):
    """Validate if a question answer is within its time limit."""
    if not question_started_at or not time_limit_seconds:
        return True
    deadline = question_started_at + timedelta(seconds=time_limit_seconds)
    return current_time <= deadline


# ========== MAIN ==========
async def main():
    print("="*60)
    print("AIProDucate Core POC Tests")
    print("="*60)
    
    results = {}
    
    # Test 1: PostgreSQL
    results['PostgreSQL'] = await test_postgres_connection()
    
    # Test 2: S3
    results['S3'] = await test_s3_operations()
    
    # Test 3: Gemini
    results['Gemini'] = await test_gemini_generation()
    
    # Test 4: Auto-Grading
    results['AutoGrading'] = test_auto_grading()
    
    # Test 5: Time Validation
    results['TimeValidation'] = test_time_validation()
    
    # Summary
    print("\n" + "="*60)
    print("POC TEST SUMMARY")
    print("="*60)
    for test_name, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"  {test_name}: {status}")
    
    all_passed = all(results.values())
    print(f"\n  {'🎉 ALL TESTS PASSED!' if all_passed else '⚠️  SOME TESTS FAILED'}")
    return all_passed

if __name__ == "__main__":
    asyncio.run(main())
