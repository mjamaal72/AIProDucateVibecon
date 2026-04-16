"""Auto-grading engine for all objective question types with penalty toggles."""
from decimal import Decimal


def grade_single_select(correct_option_id, selected_option_id, marks, negative_marks=0):
    if selected_option_id is None:
        return Decimal('0')
    if str(selected_option_id) == str(correct_option_id):
        return Decimal(str(marks))
    return Decimal(str(-negative_marks)) if negative_marks else Decimal('0')


def grade_multiple_select(correct_ids: set, selected_ids: set, marks_per_correct, penalty_toggle: str):
    if not selected_ids:
        return Decimal('0')
    correct_selected = selected_ids & correct_ids
    incorrect_selected = selected_ids - correct_ids
    mpc = Decimal(str(marks_per_correct))
    if penalty_toggle == 'A':
        if incorrect_selected:
            return Decimal('0')
        return Decimal(str(len(correct_selected))) * mpc
    elif penalty_toggle == 'B':
        score = (Decimal(str(len(correct_selected))) - Decimal(str(len(incorrect_selected)))) * mpc
        return max(Decimal('0'), score)
    elif penalty_toggle == 'C':
        return Decimal(str(len(correct_selected))) * mpc
    if selected_ids == correct_ids:
        return Decimal(str(len(correct_ids))) * mpc
    return Decimal('0')


def grade_fill_blank(correct_answers: dict, student_answers: dict, marks_per_blank, penalty_toggle: str):
    if not student_answers:
        return Decimal('0')
    correct_count = 0
    incorrect_count = 0
    mpb = Decimal(str(marks_per_blank))
    for blank_idx, correct_val in correct_answers.items():
        student_val = student_answers.get(str(blank_idx), "")
        if str(student_val).strip().lower() == str(correct_val).strip().lower():
            correct_count += 1
        else:
            incorrect_count += 1
    if penalty_toggle == 'A':
        return Decimal('0') if incorrect_count > 0 else Decimal(str(correct_count)) * mpb
    elif penalty_toggle == 'B':
        return max(Decimal('0'), (Decimal(str(correct_count)) - Decimal(str(incorrect_count))) * mpb)
    elif penalty_toggle == 'C':
        return Decimal(str(correct_count)) * mpb
    return Decimal(str(correct_count)) * mpb if incorrect_count == 0 else Decimal('0')


def grade_matching(correct_pairs: dict, student_pairs: dict, marks_per_pair, penalty_toggle: str):
    if not student_pairs:
        return Decimal('0')
    correct_count = 0
    incorrect_count = 0
    mpp = Decimal(str(marks_per_pair))
    for left_id, correct_right in correct_pairs.items():
        student_right = student_pairs.get(str(left_id))
        if str(student_right) == str(correct_right):
            correct_count += 1
        elif student_right is not None:
            incorrect_count += 1
    if penalty_toggle == 'A':
        return Decimal('0') if incorrect_count > 0 else Decimal(str(correct_count)) * mpp
    elif penalty_toggle == 'B':
        return max(Decimal('0'), (Decimal(str(correct_count)) - Decimal(str(incorrect_count))) * mpp)
    elif penalty_toggle == 'C':
        return Decimal(str(correct_count)) * mpp
    return Decimal(str(correct_count)) * mpp if incorrect_count == 0 else Decimal('0')


def grade_sequence_absolute(correct_order: list, student_order: list, marks_per_position, penalty_toggle: str):
    if not student_order:
        return Decimal('0')
    correct_count = 0
    incorrect_count = 0
    mpp = Decimal(str(marks_per_position))
    for i, item in enumerate(student_order):
        if i < len(correct_order) and str(item) == str(correct_order[i]):
            correct_count += 1
        else:
            incorrect_count += 1
    if penalty_toggle == 'A':
        return Decimal('0') if incorrect_count > 0 else Decimal(str(correct_count)) * mpp
    elif penalty_toggle == 'B':
        return max(Decimal('0'), (Decimal(str(correct_count)) - Decimal(str(incorrect_count))) * mpp)
    elif penalty_toggle == 'C':
        return Decimal(str(correct_count)) * mpp
    return Decimal(str(correct_count)) * mpp if incorrect_count == 0 else Decimal('0')


def grade_sequence_relative(correct_order: list, student_order: list, marks_per_link, penalty_toggle: str):
    if len(student_order) < 2:
        return Decimal('0')
    correct_links = set()
    for i in range(len(correct_order) - 1):
        correct_links.add((str(correct_order[i]), str(correct_order[i + 1])))
    correct_count = 0
    incorrect_count = 0
    mpl = Decimal(str(marks_per_link))
    for i in range(len(student_order) - 1):
        pair = (str(student_order[i]), str(student_order[i + 1]))
        if pair in correct_links:
            correct_count += 1
        else:
            incorrect_count += 1
    if penalty_toggle == 'A':
        return Decimal('0') if incorrect_count > 0 else Decimal(str(correct_count)) * mpl
    elif penalty_toggle == 'B':
        return max(Decimal('0'), (Decimal(str(correct_count)) - Decimal(str(incorrect_count))) * mpl)
    elif penalty_toggle == 'C':
        return Decimal(str(correct_count)) * mpl
    return Decimal(str(correct_count)) * mpl if incorrect_count == 0 else Decimal('0')


def grade_toggle_binary(correct_values: dict, student_values: dict, marks_per_toggle, penalty_toggle: str):
    if not student_values:
        return Decimal('0')
    correct_count = 0
    incorrect_count = 0
    mpt = Decimal(str(marks_per_toggle))
    for stmt_id, correct_val in correct_values.items():
        student_val = student_values.get(str(stmt_id))
        if student_val is not None and str(student_val).lower() == str(correct_val).lower():
            correct_count += 1
        elif student_val is not None:
            incorrect_count += 1
    if penalty_toggle == 'A':
        return Decimal('0') if incorrect_count > 0 else Decimal(str(correct_count)) * mpt
    elif penalty_toggle == 'B':
        return max(Decimal('0'), (Decimal(str(correct_count)) - Decimal(str(incorrect_count))) * mpt)
    elif penalty_toggle == 'C':
        return Decimal(str(correct_count)) * mpt
    return Decimal(str(correct_count)) * mpt if incorrect_count == 0 else Decimal('0')


def auto_grade_response(question, options, response_payload):
    """Grade a response based on question type and options."""
    import json
    qtype = question.question_type
    marks = float(question.marks or 1)
    neg_marks = float(question.negative_marks or 0)
    penalty = question.penalty_logic_type or 'NONE'
    
    try:
        payload = json.loads(response_payload) if isinstance(response_payload, str) else response_payload
    except (json.JSONDecodeError, TypeError):
        payload = response_payload
    
    if qtype == 'SINGLE_SELECT':
        correct_opts = [o for o in options if o.is_correct]
        if not correct_opts:
            return Decimal('0')
        # Check if option-based marks
        if any(o.partial_marks is not None for o in options):
            selected_id = str(payload) if payload else None
            for o in options:
                if str(o.option_id) == selected_id and o.partial_marks is not None:
                    return Decimal(str(o.partial_marks))
            return Decimal('0')
        correct_id = str(correct_opts[0].option_id)
        selected_id = str(payload) if payload else None
        return grade_single_select(correct_id, selected_id, marks, neg_marks)
    
    elif qtype == 'MULTIPLE_SELECT':
        correct_ids = {str(o.option_id) for o in options if o.is_correct}
        selected_ids = set(str(x) for x in payload) if isinstance(payload, list) else set()
        mpc = Decimal(str(marks)) / Decimal(str(len(correct_ids))) if correct_ids else Decimal('1')
        return grade_multiple_select(correct_ids, selected_ids, float(mpc), penalty)
    
    elif qtype == 'FILL_BLANK':
        correct_answers = {}
        for o in sorted(options, key=lambda x: x.display_sequence):
            if o.is_correct:
                correct_answers[str(o.display_sequence)] = o.content_left
        student_answers = payload if isinstance(payload, dict) else {}
        mpb = Decimal(str(marks)) / Decimal(str(len(correct_answers))) if correct_answers else Decimal('1')
        return grade_fill_blank(correct_answers, student_answers, float(mpb), penalty)
    
    elif qtype == 'MATCHING':
        correct_pairs = {str(o.option_id): o.content_right for o in options if o.is_correct}
        student_pairs = payload if isinstance(payload, dict) else {}
        mpp = Decimal(str(marks)) / Decimal(str(len(correct_pairs))) if correct_pairs else Decimal('1')
        return grade_matching(correct_pairs, student_pairs, float(mpp), penalty)
    
    elif qtype == 'SEQUENCING':
        correct_order = [str(o.option_id) for o in sorted(options, key=lambda x: x.display_sequence)]
        student_order = [str(x) for x in payload] if isinstance(payload, list) else []
        if penalty == 'RELATIVE':
            mpl = Decimal(str(marks)) / Decimal(str(max(1, len(correct_order) - 1)))
            return grade_sequence_relative(correct_order, student_order, float(mpl), 'C')
        mpp = Decimal(str(marks)) / Decimal(str(len(correct_order))) if correct_order else Decimal('1')
        return grade_sequence_absolute(correct_order, student_order, float(mpp), penalty)
    
    elif qtype == 'TOGGLE_BINARY':
        correct_values = {str(o.option_id): str(o.is_correct).lower() for o in options}
        student_values = {str(k): str(v).lower() for k, v in payload.items()} if isinstance(payload, dict) else {}
        mpt = Decimal(str(marks)) / Decimal(str(len(correct_values))) if correct_values else Decimal('1')
        return grade_toggle_binary(correct_values, student_values, float(mpt), penalty)
    
    return None  # Manual grading types
