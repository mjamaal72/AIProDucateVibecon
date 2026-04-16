import requests
import sys
import json
import uuid
from datetime import datetime, timedelta
import io

class ComprehensiveAPITester:
    def __init__(self, base_url="https://aiproducate-eval.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.student_token = None
        self.examiner_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_eval_id = None
        self.created_section_id = None
        self.created_questions = {}  # question_type -> question_id
        self.created_attempt_id = None
        self.examiner_user_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None, files=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {}
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        if files is None:
            headers['Content-Type'] = 'application/json'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    response = requests.post(url, data=data, files=files, headers={k:v for k,v in headers.items() if k != 'Content-Type'})
                else:
                    response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test health endpoint"""
        return self.run_test("Health Check", "GET", "health", 200)

    def test_admin_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"unique_identifier": "admin001", "password": "admin123"}
        )
        if success and 'token' in response:
            self.admin_token = response['token']
            print(f"   Admin token obtained")
            return True
        return False

    def test_student_login(self):
        """Test student login"""
        success, response = self.run_test(
            "Student Login",
            "POST",
            "auth/login",
            200,
            data={"unique_identifier": "student001", "password": "student123"}
        )
        if success and 'token' in response:
            self.student_token = response['token']
            print(f"   Student token obtained")
            return True
        return False

    def test_register_examiner(self):
        """Register examiner user for correction testing"""
        examiner_data = {
            "unique_identifier": "examiner001",
            "full_name": "Test Examiner",
            "email": "examiner@test.com",
            "password": "examiner123",
            "role": "EXAMINER"
        }
        
        success, response = self.run_test(
            "Register Examiner",
            "POST",
            "auth/register",
            200,
            data=examiner_data
        )
        if success and 'token' in response:
            self.examiner_token = response['token']
            self.examiner_user_id = response['user']['user_id']
            print(f"   Examiner registered with ID: {self.examiner_user_id}")
            return True
        return False

    def test_auth_me_endpoints(self):
        """Test /auth/me for all user types"""
        tests = [
            ("Admin", self.admin_token),
            ("Student", self.student_token),
            ("Examiner", self.examiner_token)
        ]
        
        all_passed = True
        for user_type, token in tests:
            success, response = self.run_test(
                f"Auth Me ({user_type})",
                "GET",
                "auth/me",
                200,
                token=token
            )
            if success:
                print(f"   {user_type}: {response.get('unique_identifier')} - {response.get('role')}")
            all_passed = all_passed and success
        
        return all_passed

    def test_create_evaluation(self):
        """Test creating evaluation"""
        start_time = (datetime.now() + timedelta(minutes=-30)).isoformat()  # Started 30 min ago
        end_time = (datetime.now() + timedelta(hours=2)).isoformat()
        
        eval_data = {
            "eval_title": "Comprehensive Test Evaluation",
            "duration_minutes": 120,
            "max_attempts": 3,
            "start_time": start_time,
            "end_time": end_time,
            "visibility": "PUBLIC",
            "passing_percentage": 60.0,
            "shuffle_categories": False,
            "shuffle_questions": False,
            "enable_proctoring": True,
            "show_instant_results": False,
            "allow_navigation": True
        }
        
        success, response = self.run_test(
            "Create Evaluation",
            "POST",
            "evaluations",
            200,
            data=eval_data,
            token=self.admin_token
        )
        if success and 'eval_id' in response:
            self.created_eval_id = response['eval_id']
            print(f"   Created evaluation ID: {self.created_eval_id}")
        return success

    def test_create_section(self):
        """Test creating evaluation section"""
        if not self.created_eval_id:
            print("❌ Skipping - No evaluation ID available")
            return False
        
        section_data = {
            "section_name": "Comprehensive Test Section",
            "target_question_count": 10,
            "target_total_marks": 50.0,
            "instructions": "Answer all questions carefully"
        }
        
        success, response = self.run_test(
            "Create Section",
            "POST",
            f"evaluations/{self.created_eval_id}/sections",
            200,
            data=section_data,
            token=self.admin_token
        )
        if success and 'section_id' in response:
            self.created_section_id = response['section_id']
            print(f"   Created section ID: {self.created_section_id}")
        return success

    def test_create_all_question_types(self):
        """Test creating all 9 question types"""
        if not self.created_eval_id:
            print("❌ Skipping - No evaluation ID available")
            return False

        question_types = [
            {
                "type": "SINGLE_SELECT",
                "data": {
                    "eval_id": self.created_eval_id,
                    "section_id": self.created_section_id,
                    "question_type": "SINGLE_SELECT",
                    "content_html": "<p>What is 2 + 2?</p>",
                    "marks": 2.0,
                    "negative_marks": 0.5,
                    "options": [
                        {"content_left": "3", "is_correct": False, "display_sequence": 0},
                        {"content_left": "4", "is_correct": True, "display_sequence": 1},
                        {"content_left": "5", "is_correct": False, "display_sequence": 2},
                        {"content_left": "6", "is_correct": False, "display_sequence": 3}
                    ]
                }
            },
            {
                "type": "MULTIPLE_SELECT",
                "data": {
                    "eval_id": self.created_eval_id,
                    "section_id": self.created_section_id,
                    "question_type": "MULTIPLE_SELECT",
                    "content_html": "<p>Which are even numbers?</p>",
                    "marks": 3.0,
                    "penalty_logic_type": "C",
                    "options": [
                        {"content_left": "2", "is_correct": True, "display_sequence": 0},
                        {"content_left": "3", "is_correct": False, "display_sequence": 1},
                        {"content_left": "4", "is_correct": True, "display_sequence": 2},
                        {"content_left": "5", "is_correct": False, "display_sequence": 3}
                    ]
                }
            },
            {
                "type": "FILL_BLANK",
                "data": {
                    "eval_id": self.created_eval_id,
                    "section_id": self.created_section_id,
                    "question_type": "FILL_BLANK",
                    "content_html": "<p>The capital of France is ___BLANK___.</p>",
                    "marks": 2.0,
                    "options": [
                        {"content_left": "Paris", "is_correct": True, "display_sequence": 0},
                        {"content_left": "London", "is_correct": False, "display_sequence": 1}
                    ]
                }
            },
            {
                "type": "MATCHING",
                "data": {
                    "eval_id": self.created_eval_id,
                    "section_id": self.created_section_id,
                    "question_type": "MATCHING",
                    "content_html": "<p>Match the following countries with their capitals</p>",
                    "marks": 4.0,
                    "options": [
                        {"content_left": "France", "content_right": "Paris", "is_correct": True, "display_sequence": 0},
                        {"content_left": "Germany", "content_right": "Berlin", "is_correct": True, "display_sequence": 1},
                        {"content_left": "Italy", "content_right": "Rome", "is_correct": True, "display_sequence": 2}
                    ]
                }
            },
            {
                "type": "TOGGLE_BINARY",
                "data": {
                    "eval_id": self.created_eval_id,
                    "section_id": self.created_section_id,
                    "question_type": "TOGGLE_BINARY",
                    "content_html": "<p>Mark each statement as True or False</p>",
                    "marks": 3.0,
                    "options": [
                        {"content_left": "Earth is round", "is_correct": True, "display_sequence": 0},
                        {"content_left": "Sun revolves around Earth", "is_correct": False, "display_sequence": 1},
                        {"content_left": "Water boils at 100°C", "is_correct": True, "display_sequence": 2}
                    ]
                }
            },
            {
                "type": "SUBJECTIVE_TYPING",
                "data": {
                    "eval_id": self.created_eval_id,
                    "section_id": self.created_section_id,
                    "question_type": "SUBJECTIVE_TYPING",
                    "content_html": "<p>Explain the concept of photosynthesis in 200 words.</p>",
                    "marks": 10.0,
                    "word_limit": 200,
                    "options": []
                }
            }
        ]

        all_passed = True
        for q_type in question_types:
            success, response = self.run_test(
                f"Create {q_type['type']} Question",
                "POST",
                "questions",
                200,
                data=q_type['data'],
                token=self.admin_token
            )
            if success and 'question_id' in response:
                self.created_questions[q_type['type']] = response['question_id']
                print(f"   Created {q_type['type']} question ID: {response['question_id']}")
            all_passed = all_passed and success

        return all_passed

    def test_list_questions_by_eval(self):
        """Test listing questions by evaluation"""
        if not self.created_eval_id:
            print("❌ Skipping - No evaluation ID available")
            return False
        
        success, response = self.run_test(
            "List Questions by Eval",
            "GET",
            f"questions/by-eval/{self.created_eval_id}",
            200,
            token=self.admin_token
        )
        if success:
            print(f"   Found {len(response)} questions")
        return success

    def test_start_exam_attempt(self):
        """Test starting exam attempt"""
        if not self.created_eval_id:
            print("❌ Skipping - No evaluation ID available")
            return False
        
        success, response = self.run_test(
            "Start Exam Attempt",
            "POST",
            f"attempts/start?eval_id={self.created_eval_id}",
            200,
            token=self.student_token
        )
        if success and response.get('attempt', {}).get('attempt_id'):
            self.created_attempt_id = response['attempt']['attempt_id']
            print(f"   Created attempt ID: {self.created_attempt_id}")
        return success

    def test_submit_answers_with_auto_grading(self):
        """Test submitting answers with auto-grading"""
        if not self.created_attempt_id or not self.created_questions:
            print("❌ Skipping - No attempt or questions available")
            return False

        # Submit answers for different question types
        answers = [
            {
                "question_type": "SINGLE_SELECT",
                "response_payload": self.created_questions.get("SINGLE_SELECT", 1) + 1  # Assuming option ID
            },
            {
                "question_type": "MULTIPLE_SELECT", 
                "response_payload": [self.created_questions.get("MULTIPLE_SELECT", 1) + 1, self.created_questions.get("MULTIPLE_SELECT", 1) + 3]
            },
            {
                "question_type": "FILL_BLANK",
                "response_payload": "Paris"
            },
            {
                "question_type": "SUBJECTIVE_TYPING",
                "response_payload": "Photosynthesis is the process by which plants convert light energy into chemical energy..."
            }
        ]

        all_passed = True
        for answer in answers:
            if answer["question_type"] in self.created_questions:
                answer_data = {
                    "question_id": self.created_questions[answer["question_type"]],
                    "response_payload": answer["response_payload"],
                    "is_bookmarked": False,
                    "time_spent_seconds": 45
                }
                
                success, response = self.run_test(
                    f"Submit {answer['question_type']} Answer",
                    "POST",
                    f"attempts/{self.created_attempt_id}/answer",
                    200,
                    data=answer_data,
                    token=self.student_token
                )
                if success and 'auto_graded_marks' in response:
                    print(f"   Auto-graded marks: {response.get('auto_graded_marks', 'N/A')}")
                all_passed = all_passed and success

        return all_passed

    def test_submit_exam(self):
        """Test final exam submission"""
        if not self.created_attempt_id:
            print("❌ Skipping - No attempt ID available")
            return False
        
        success, response = self.run_test(
            "Submit Exam",
            "POST",
            f"attempts/{self.created_attempt_id}/submit",
            200,
            token=self.student_token
        )
        if success:
            print(f"   Final score: {response.get('total_score', 'N/A')}")
            print(f"   Passed: {response.get('is_passed', 'N/A')}")
        return success

    def test_leaderboard(self):
        """Test leaderboard endpoint"""
        if not self.created_eval_id:
            print("❌ Skipping - No evaluation ID available")
            return False
        
        success, response = self.run_test(
            "Get Leaderboard",
            "GET",
            f"attempts/leaderboard/{self.created_eval_id}",
            200,
            token=self.admin_token
        )
        if success:
            print(f"   Leaderboard entries: {len(response)}")
        return success

    def test_item_analysis(self):
        """Test item analysis endpoint"""
        if not self.created_eval_id:
            print("❌ Skipping - No evaluation ID available")
            return False
        
        success, response = self.run_test(
            "Get Item Analysis",
            "GET",
            f"analytics/item-analysis/{self.created_eval_id}",
            200,
            token=self.admin_token
        )
        if success:
            print(f"   Total attempts analyzed: {response.get('total_attempts', 0)}")
            print(f"   Questions analyzed: {len(response.get('questions', []))}")
        return success

    def test_manual_correction_workflow(self):
        """Test manual correction workflow"""
        if not self.created_eval_id or not self.examiner_user_id:
            print("❌ Skipping - No evaluation or examiner available")
            return False

        # 1. Allocate examiner
        allocation_data = {
            "examiner_id": self.examiner_user_id,
            "max_assignment_limit": 50,
            "section_filter_id": self.created_section_id
        }
        
        success1, response1 = self.run_test(
            "Allocate Examiner",
            "POST",
            f"correction/{self.created_eval_id}/allocate",
            200,
            data=allocation_data,
            token=self.admin_token
        )

        # 2. Distribute responses
        success2, response2 = self.run_test(
            "Distribute Responses",
            "POST",
            f"correction/{self.created_eval_id}/distribute",
            200,
            token=self.admin_token
        )
        if success2:
            print(f"   Distributed responses: {response2.get('distributed', 0)}")

        # 3. Get allocations
        success3, response3 = self.run_test(
            "Get Allocations",
            "GET",
            f"correction/{self.created_eval_id}/allocations",
            200,
            token=self.admin_token
        )

        # 4. Get examiner's assigned responses
        success4, response4 = self.run_test(
            "Get My Responses (Examiner)",
            "GET",
            f"correction/{self.created_eval_id}/my-responses",
            200,
            token=self.examiner_token
        )
        if success4:
            print(f"   Examiner assigned responses: {len(response4)}")

        return all([success1, success2, success3, success4])

    def test_proctoring_events(self):
        """Test proctoring event logging"""
        if not self.created_attempt_id:
            print("❌ Skipping - No attempt ID available")
            return False

        # Log different proctoring events
        events = [
            {"event_type": "TAB_SWITCH", "description": "User switched to another tab"},
            {"event_type": "WINDOW_BLUR", "description": "Window lost focus"},
            {"event_type": "FULLSCREEN_EXIT", "description": "User exited fullscreen mode"}
        ]

        all_passed = True
        for event in events:
            success, response = self.run_test(
                f"Log {event['event_type']} Event",
                "POST",
                f"proctoring/{self.created_attempt_id}/event",
                200,
                data=event,
                token=self.student_token
            )
            all_passed = all_passed and success

        # Get proctoring events
        success1, response1 = self.run_test(
            "Get Proctoring Events",
            "GET",
            f"proctoring/{self.created_attempt_id}/events",
            200,
            token=self.admin_token
        )
        if success1:
            print(f"   Total proctoring events: {len(response1)}")

        # Get proctoring summary
        success2, response2 = self.run_test(
            "Get Proctoring Summary",
            "GET",
            f"proctoring/{self.created_attempt_id}/summary",
            200,
            token=self.admin_token
        )
        if success2:
            print(f"   Total violations: {response2.get('total_violations', 0)}")

        return all_passed and success1 and success2

    def test_file_upload(self):
        """Test S3 file upload"""
        # Create a test file
        test_content = b"This is a test file for upload testing."
        test_file = io.BytesIO(test_content)
        
        files = {
            'file': ('test.txt', test_file, 'text/plain')
        }
        
        success, response = self.run_test(
            "Upload File to S3",
            "POST",
            "uploads",
            200,
            files=files,
            token=self.admin_token
        )
        if success:
            print(f"   Uploaded file: {response.get('original_filename')}")
            print(f"   Storage path: {response.get('storage_path')}")
            print(f"   File size: {response.get('size')} bytes")
        return success

def main():
    print("🚀 Starting Comprehensive AIProDucate API Testing...")
    tester = ComprehensiveAPITester()
    
    # Test sequence
    tests = [
        tester.test_health_check,
        tester.test_admin_login,
        tester.test_student_login,
        tester.test_register_examiner,
        tester.test_auth_me_endpoints,
        tester.test_create_evaluation,
        tester.test_create_section,
        tester.test_create_all_question_types,
        tester.test_list_questions_by_eval,
        tester.test_start_exam_attempt,
        tester.test_submit_answers_with_auto_grading,
        tester.test_submit_exam,
        tester.test_leaderboard,
        tester.test_item_analysis,
        tester.test_manual_correction_workflow,
        tester.test_proctoring_events,
        tester.test_file_upload
    ]
    
    # Run all tests
    for test in tests:
        try:
            test()
        except Exception as e:
            print(f"❌ Test {test.__name__} failed with exception: {e}")
    
    # Print results
    print(f"\n📊 Comprehensive Test Results:")
    print(f"   Tests run: {tester.tests_run}")
    print(f"   Tests passed: {tester.tests_passed}")
    print(f"   Tests failed: {tester.tests_run - tester.tests_passed}")
    print(f"   Success rate: {(tester.tests_passed / tester.tests_run * 100):.1f}%")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())