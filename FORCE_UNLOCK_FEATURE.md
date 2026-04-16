# Force Unlock Evaluation Feature

## Overview
The **Force Unlock** feature allows administrators to manually unlock an evaluation for editing, even when there are active student attempts. This is useful for urgent fixes or modifications that cannot wait.

---

## ⚠️ Important Warning

**Use this feature with extreme caution!**

When you force unlock an evaluation:
- Changes to questions/settings will **immediately affect ongoing student exams**
- Student responses may become **inconsistent** with modified questions
- The evaluation integrity may be **compromised**

**Recommended Alternative:** Consider creating a new evaluation version or deleting all attempts first if it's safe to reset.

---

## When to Use Force Unlock

### ✅ Appropriate Use Cases:
1. **Critical typo fix** - A question has a spelling error that changes the meaning
2. **Wrong answer key** - The correct answer was marked incorrectly
3. **Urgent content update** - Time-sensitive information needs correction
4. **Technical issue** - A question is broken and needs immediate fix
5. **Development/Testing** - Testing scenarios where student data isn't critical

### ❌ When NOT to Use:
1. **Regular edits** - Wait for all attempts to complete
2. **Non-urgent changes** - Create a new evaluation instead
3. **Active high-stakes exams** - Never during important assessments
4. **Before checking attempts** - Always review if students are actively taking the exam

---

## How to Use

### Visual Indicator: Lock Status Badge

Locked evaluations now show a **🔒 Locked** badge on the evaluation card, next to other badges like "Shuffle Q", "Proctored", etc.

### Step-by-Step Guide

1. **Login as Admin**
   - Username: `admin001`
   - Password: `admin123`

2. **Go to Evaluation Management**
   - Navigate to the first tab in the sidebar

3. **Identify Locked Evaluation**
   - Look for evaluations with the **🔒 Locked** red badge
   - These evaluations have active student attempts

4. **Open Dropdown Menu**
   - Click the dropdown button (⋮) on the evaluation card

5. **Select "Force Unlock for Editing"**
   - This option **only appears** for locked evaluations
   - Click to open the confirmation dialog

6. **Review Warning Dialog**
   The dialog shows:
   
   **What you can do:**
   - ✓ Edit questions and settings
   - ✓ Modify sections and content
   - ✓ Change evaluation configuration
   
   **Warnings:**
   - ⚠️ Students with active attempts may be affected
   - ⚠️ Changes will apply to ongoing exams immediately
   - ⚠️ Student responses may become inconsistent
   
   **Tip:**
   - 💡 Consider creating a new evaluation instead
   - 💡 Or delete all attempts first if it's safe to reset

7. **Confirm or Cancel**
   - Click **"Force Unlock"** (blue button) to proceed
   - Click **"Cancel"** to abort

8. **Verify Success**
   - ✅ Toast notification: "Evaluation 'Name' force unlocked for editing"
   - ⚠️ Warning toast: "Active student attempts exist" (if applicable)
   - 🔒 Badge disappears from the card
   - You can now click "Edit" to modify the evaluation

---

## Automatic Lock/Unlock Behavior

### When Evaluations Get Locked:
- **Automatically locked** when the first student starts an attempt
- Prevents accidental modifications during active exams
- Protects evaluation integrity

### When Evaluations Get Unlocked:
- **Automatically unlocked** when you delete all attempts
- Can be **manually unlocked** using Force Unlock feature
- Remains unlocked until next student starts

---

## Technical Details

### Backend API Endpoint
```
PUT /api/evaluations/{eval_id}/force-unlock
```

**Access Control:** Admin only (403 Forbidden for Students/Examiners)

**Response:**
```json
{
  "message": "Evaluation 'Name' force unlocked for editing",
  "attempt_count": 5,
  "warning": "Active student attempts exist"
}
```

**Database Change:**
```sql
UPDATE evaluations 
SET is_locked_for_editing = FALSE 
WHERE eval_id = {eval_id}
```

### Frontend Components

**Lock Status Badge:**
```jsx
{ev.is_locked_for_editing && (
  <Badge className="text-xs bg-red-100 text-red-700">
    🔒 Locked
  </Badge>
)}
```

**Conditional Menu Item:**
```jsx
{ev.is_locked_for_editing && (
  <DropdownMenuItem onClick={() => handleForceUnlock(...)}>
    <Edit size={14} className="mr-2" />
    Force Unlock for Editing
  </DropdownMenuItem>
)}
```

---

## Comparison: Force Unlock vs Delete Attempts

| Feature | Force Unlock | Delete All Attempts |
|---------|-------------|---------------------|
| **Purpose** | Edit while keeping attempts | Reset and start fresh |
| **Student Data** | Preserved | Deleted permanently |
| **Leaderboard** | Remains intact | Reset to empty |
| **Use Case** | Urgent fixes | Development/testing reset |
| **Risk Level** | ⚠️ High | ⚠️ Medium (with confirmation) |
| **Reversible** | ✅ Yes (can re-lock) | ❌ No (data gone) |
| **Best Practice** | Last resort | Preferred method |

---

## Best Practices

### 1. Check Active Attempts First
Before force unlocking, verify how many students are currently taking the exam:
- Go to **Leaderboard** for that evaluation
- Check **Student Portal** to see who has active attempts
- Consider the timing (peak exam hours vs off-hours)

### 2. Communicate with Students
If force unlocking during active exams:
- Announce the upcoming change via email/announcement
- Explain what's being fixed and why
- Provide a grace period if possible
- Consider extending exam time to compensate

### 3. Document Changes
After force unlocking and making changes:
- Document what was modified in evaluation notes
- Keep a record of when the unlock occurred
- Log which questions/settings were changed
- Review impact on student responses

### 4. Review After Unlock
Once unlocked and edited:
- Check the leaderboard for anomalies
- Review student responses for affected questions
- Consider manual corrections if needed
- Monitor for student complaints or confusion

### 5. Prefer Alternatives
Before using force unlock, consider:
- **Can it wait?** Wait for all attempts to finish
- **Is it critical?** Minor issues can wait
- **New version?** Create a duplicate evaluation with fixes
- **Delete & reset?** If no data loss concerns, delete attempts instead

---

## Troubleshooting

### "Force Unlock" option not appearing

**Cause:** Evaluation is already unlocked

**Solution:** 
- Check for the 🔒 Locked badge on the card
- If not locked, you can edit directly
- No need to force unlock

### Still can't edit after unlocking

**Cause:** Browser cache or session issue

**Solution:**
1. Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
2. Verify unlock status in dropdown menu
3. Check browser console for errors
4. Try logging out and back in

### Changes not reflecting for students

**Cause:** Student exam view is cached

**Solution:**
- Changes apply immediately to new question loads
- Students need to navigate to next/previous question
- Consider announcing a manual refresh if critical

---

## Security & Access Control

### Who Can Force Unlock?
- ✅ **Admin** - Full access
- ❌ **Examiner/Creator** - Cannot force unlock (even if they created the evaluation)
- ❌ **Student** - No access

### Audit Trail
Currently, force unlock actions are not logged. Consider adding audit logging for:
- Who unlocked the evaluation
- When it was unlocked
- How many active attempts existed
- What changes were made after unlock

---

## Examples

### Example 1: Typo Fix During Active Exam
```
Scenario: Final exam is live, 50 students taking it.
          Question 5 has "What is 2+2?" but answer key says "5"

Solution:
1. Force unlock evaluation
2. Go to Question Bank
3. Edit Question 5, change answer key to "4"
4. Save changes
5. Announce to students: "Question 5 answer corrected, all submissions will be re-graded"
6. Monitor leaderboard for score adjustments
```

### Example 2: Development Testing
```
Scenario: Testing new question types with dummy student accounts

Solution:
1. Students create test attempts
2. You need to modify questions based on feedback
3. Force unlock evaluation
4. Make changes and test again
5. Or better: Delete all attempts and unlock automatically
```

### Example 3: Wrong Date/Time Settings
```
Scenario: Evaluation end time was set incorrectly
          Students are running out of time

Solution:
1. Force unlock evaluation
2. Edit evaluation settings
3. Extend end time by 30 minutes
4. Save changes
5. Announce to students
```

---

## Success Criteria

✅ **Backend:** Force unlock endpoint working with admin-only access  
✅ **Frontend:** Lock badge visible on cards  
✅ **Frontend:** Force unlock menu item appears only for locked evaluations  
✅ **Frontend:** Comprehensive warning dialog with tips  
✅ **UX:** Blue color theme for unlock (distinct from red delete)  
✅ **Testing:** Tested unlock → edit → verify flow  

---

## Files Modified

**Backend:**
- `/app/backend/routers/evaluation_router.py`
  - Added `PUT /api/evaluations/{eval_id}/force-unlock` endpoint
  - Returns attempt count and warning if attempts exist

**Frontend:**
- `/app/frontend/src/pages/EvaluationManagement.js`
  - Added lock status badge (🔒 Locked)
  - Added "Force Unlock for Editing" menu item (conditional)
  - Added comprehensive confirmation dialog
  - Added `handleForceUnlock` handler

**Documentation:**
- `/app/FORCE_UNLOCK_FEATURE.md` - This guide

---

## Related Features

- **Delete All Attempts** - Alternative that resets evaluation completely
- **Archive Evaluation** - Move to archive without losing data
- **Evaluation Lock** - Automatic lock when students start attempts

---

**Last Updated:** April 16, 2026  
**Status:** ✅ Complete and Tested  
**Priority:** High (Admin tool for urgent scenarios)
