import requests
import sys
import json
from datetime import datetime, timedelta

class AIProDucateAPITester:
    def __init__(self, base_url="https://aiproducate-eval.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.student_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_eval_id = None
        self.created_question_id = None
        self.created_attempt_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
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
            print(f"   Admin token obtained: {self.admin_token[:20]}...")
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
            print(f"   Student token obtained: {self.student_token[:20]}...")
            return True
        return False

    def test_auth_me_admin(self):
        """Test /auth/me with admin token"""
        success, response = self.run_test(
            "Auth Me (Admin)",
            "GET",
            "auth/me",
            200,
            token=self.admin_token
        )
        if success:
            print(f"   Admin user: {response.get('unique_identifier')} - {response.get('role')}")
        return success

    def test_auth_me_student(self):
        """Test /auth/me with student token"""
        success, response = self.run_test(
            "Auth Me (Student)",
            "GET",
            "auth/me",
            200,
            token=self.student_token
        )
        if success:
            print(f"   Student user: {response.get('unique_identifier')} - {response.get('role')}")
        return success

    def test_create_evaluation(self):
        """Test creating evaluation (admin only)"""
        start_time = (datetime.now() + timedelta(hours=1)).isoformat()
        end_time = (datetime.now() + timedelta(hours=3)).isoformat()
        
        eval_data = {
            "eval_title": "Test Evaluation",
            "duration_minutes": 60,
            "max_attempts": 2,
            "start_time": start_time,
            "end_time": end_time,
            "visibility": "PUBLIC",
            "passing_percentage": 50.0,
            "shuffle_categories": False,
            "shuffle_questions": True,
            "enable_proctoring": False,
            "show_instant_results": True,
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

    def test_list_evaluations_admin(self):
        """Test listing evaluations as admin"""
        return self.run_test(
            "List Evaluations (Admin)",
            "GET",
            "evaluations",
            200,
            token=self.admin_token
        )

    def test_list_evaluations_student(self):
        """Test listing evaluations as student"""
        return self.run_test(
            "List Evaluations (Student)",
            "GET",
            "evaluations",
            200,
            token=self.student_token
        )

    def test_get_evaluation(self):
        """Test getting specific evaluation"""
        if not self.created_eval_id:
            print("❌ Skipping - No evaluation ID available")
            return False
        
        return self.run_test(
            "Get Evaluation",
            "GET",
            f"evaluations/{self.created_eval_id}",
            200,
            token=self.admin_token
        )

    def test_update_evaluation(self):
        """Test updating evaluation"""
        if not self.created_eval_id:
            print("❌ Skipping - No evaluation ID available")
            return False
        
        update_data = {
            "eval_title": "Updated Test Evaluation",
            "duration_minutes": 90
        }
        
        return self.run_test(
            "Update Evaluation",
            "PUT",
            f"evaluations/{self.created_eval_id}",
            200,
            data=update_data,
            token=self.admin_token
        )

    def test_toggle_evaluation(self):
        """Test toggling evaluation active status"""
        if not self.created_eval_id:
            print("❌ Skipping - No evaluation ID available")
            return False
        
        return self.run_test(
            "Toggle Evaluation",
            "PATCH",
            f"evaluations/{self.created_eval_id}/toggle",
            200,
            token=self.admin_token
        )

    def test_create_section(self):
        """Test creating evaluation section"""
        if not self.created_eval_id:
            print("❌ Skipping - No evaluation ID available")
            return False
        
        section_data = {
            "section_name": "Test Section",
            "target_question_count": 5,
            "target_total_marks": 10.0,
            "instructions": "Answer all questions carefully"
        }
        
        return self.run_test(
            "Create Section",
            "POST",
            f"evaluations/{self.created_eval_id}/sections",
            200,
            data=section_data,
            token=self.admin_token
        )

    def test_create_single_select_question(self):
        """Test creating SINGLE_SELECT question"""
        if not self.created_eval_id:
            print("❌ Skipping - No evaluation ID available")
            return False
        
        question_data = {
            "eval_id": self.created_eval_id,
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
        
        success, response = self.run_test(
            "Create SINGLE_SELECT Question",
            "POST",
            "questions",
            200,
            data=question_data,
            token=self.admin_token
        )
        if success and 'question_id' in response:
            self.created_question_id = response['question_id']
            print(f"   Created question ID: {self.created_question_id}")
        return success

    def test_create_multiple_select_question(self):
        """Test creating MULTIPLE_SELECT question"""
        if not self.created_eval_id:
            print("❌ Skipping - No evaluation ID available")
            return False
        
        question_data = {
            "eval_id": self.created_eval_id,
            "question_type": "MULTIPLE_SELECT",
            "content_html": "<p>Which of the following are even numbers?</p>",
            "marks": 3.0,
            "options": [
                {"content_left": "2", "is_correct": True, "display_sequence": 0},
                {"content_left": "3", "is_correct": False, "display_sequence": 1},
                {"content_left": "4", "is_correct": True, "display_sequence": 2},
                {"content_left": "5", "is_correct": False, "display_sequence": 3}
            ]
        }
        
        return self.run_test(
            "Create MULTIPLE_SELECT Question",
            "POST",
            "questions",
            200,
            data=question_data,
            token=self.admin_token
        )

    def test_list_questions_by_eval(self):
        """Test listing questions by evaluation"""
        if not self.created_eval_id:
            print("❌ Skipping - No evaluation ID available")
            return False
        
        return self.run_test(
            "List Questions by Eval",
            "GET",
            f"questions/by-eval/{self.created_eval_id}",
            200,
            token=self.admin_token
        )

    def test_start_exam_attempt(self):
        """Test starting exam attempt (student)"""
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

    def test_submit_answer(self):
        """Test submitting answer"""
        if not self.created_attempt_id or not self.created_question_id:
            print("❌ Skipping - No attempt or question ID available")
            return False
        
        answer_data = {
            "question_id": self.created_question_id,
            "response_payload": {"selected_options": [self.created_question_id + 1]},  # Assuming option ID
            "is_bookmarked": False,
            "time_spent_seconds": 30
        }
        
        return self.run_test(
            "Submit Answer",
            "POST",
            f"attempts/{self.created_attempt_id}/answer",
            200,
            data=answer_data,
            token=self.student_token
        )

    def test_submit_exam(self):
        """Test final exam submission"""
        if not self.created_attempt_id:
            print("❌ Skipping - No attempt ID available")
            return False
        
        return self.run_test(
            "Submit Exam",
            "POST",
            f"attempts/{self.created_attempt_id}/submit",
            200,
            token=self.student_token
        )

    def test_view_leaderboard(self):
        """Test viewing leaderboard"""
        if not self.created_eval_id:
            print("❌ Skipping - No evaluation ID available")
            return False
        
        return self.run_test(
            "View Leaderboard",
            "GET",
            f"attempts/leaderboard/{self.created_eval_id}",
            200,
            token=self.student_token
        )

    def test_student_cannot_create_evaluation(self):
        """Test that student cannot create evaluation"""
        eval_data = {
            "eval_title": "Unauthorized Test",
            "duration_minutes": 60,
            "start_time": datetime.now().isoformat()
        }
        
        return self.run_test(
            "Student Cannot Create Evaluation",
            "POST",
            "evaluations",
            403,  # Expecting forbidden
            data=eval_data,
            token=self.student_token
        )

    def test_student_cannot_create_question(self):
        """Test that student cannot create question"""
        if not self.created_eval_id:
            print("❌ Skipping - No evaluation ID available")
            return False
        
        question_data = {
            "eval_id": self.created_eval_id,
            "question_type": "SINGLE_SELECT",
            "content_html": "<p>Unauthorized question</p>",
            "marks": 1.0,
            "options": []
        }
        
        return self.run_test(
            "Student Cannot Create Question",
            "POST",
            "questions",
            403,  # Expecting forbidden
            data=question_data,
            token=self.student_token
        )

def main():
    print("🚀 Starting AIProDucate API Testing...")
    tester = AIProDucateAPITester()
    
    # Test sequence
    tests = [
        tester.test_health_check,
        tester.test_admin_login,
        tester.test_student_login,
        tester.test_auth_me_admin,
        tester.test_auth_me_student,
        tester.test_create_evaluation,
        tester.test_list_evaluations_admin,
        tester.test_list_evaluations_student,
        tester.test_get_evaluation,
        tester.test_update_evaluation,
        tester.test_toggle_evaluation,
        tester.test_create_section,
        tester.test_create_single_select_question,
        tester.test_create_multiple_select_question,
        tester.test_list_questions_by_eval,
        tester.test_start_exam_attempt,
        tester.test_submit_answer,
        tester.test_submit_exam,
        tester.test_view_leaderboard,
        tester.test_student_cannot_create_evaluation,
        tester.test_student_cannot_create_question
    ]
    
    # Run all tests
    for test in tests:
        try:
            test()
        except Exception as e:
            print(f"❌ Test {test.__name__} failed with exception: {e}")
    
    # Print results
    print(f"\n📊 Test Results:")
    print(f"   Tests run: {tester.tests_run}")
    print(f"   Tests passed: {tester.tests_passed}")
    print(f"   Tests failed: {tester.tests_run - tester.tests_passed}")
    print(f"   Success rate: {(tester.tests_passed / tester.tests_run * 100):.1f}%")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())