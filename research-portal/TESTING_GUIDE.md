# Testing Guide: Access Control & Dashboard Implementation

## Quick Start Testing

### 1. Start the Server

```bash
cd research-portal
npm start
```

### 2. Test Flow for Each Role

## Author Testing (Role: Author)

### Scenario 1: Submit Paper

1. Log in as Author
2. Go to Dashboard
3. Click "Submit Paper"
4. Fill form:
   - Title: "Machine Learning Applications" (min 10 chars)
   - Abstract: "This paper explores recent advances..." (min 100 chars)
   - Keywords: "machine learning, AI, applications"
   - Select PDF file
5. Click "Submit Paper"
6. **Expected**: Paper added, PaperAccess created with accessLevel='owner'
7. **Verify**: Author paper count increases by 1

### Scenario 2: Add Editor Collaborator

1. Click "Manage Access" on Author Dashboard
2. See list of your papers
3. Click "+ Add Editor" for a paper
4. Enter collaborator email
5. Click Add
6. **Expected**: Editor access granted, PaperAccess created with accessLevel='editor'
7. **Verify**: Collaborator count increases
8. **Verify**: Collaborator can now see this paper in their papers list

### Scenario 3: Revoke Editor Access

1. Click "Manage Access" on Author Dashboard
2. Find editor to remove
3. Click "Remove" button
4. Confirm removal
5. **Expected**: Access revoked, PaperAccess status changed to 'REVOKED'
6. **Verify**: Collaborator no longer sees this paper

### Expected Author Dashboard Stats

- My Papers: Count of papers submitted
- Paper Collaborators: Count of editors with access
- Can submit papers, manage collaborators, check review status

---

## Reviewer Testing (Role: Reviewer)

### Scenario 1: View Assigned Papers

1. Log in as Reviewer
2. Go to Dashboard
3. **Expected**: Reviewer Dashboard section shows
4. **Expected**: "Assigned Reviews" count = 0 (initially)

### Scenario 2: View Paper After Assignment

1. Editor (test as Editor) assigns a paper to reviewer
2. Refresh Reviewer dashboard
3. **Expected**: Paper count increases
4. **Expected**: PaperAccess created with accessLevel='reviewer', status='ACTIVE'
5. Click "View Assigned" or go to Papers page
6. **Expected**: Can see the paper
7. Click on paper
8. **Expected**: Can download PDF (read-only)

### Scenario 3: Cannot Access Unassigned Papers

1. As Reviewer, try to access a paper not assigned to you
2. **Expected**: 403 Forbidden error
3. **Expected**: Paper does not appear in Assigned Reviews list

### Scenario 4: Submit Review

1. Click on assigned paper
2. Click "Submit Review"
3. Fill review form with:
   - Summary: Review text (min 50 chars)
   - Rating: 1-5 stars
   - Recommendation: ACCEPT/REJECT/MINOR_REVISION/MAJOR_REVISION
4. Submit
5. **Expected**: Review created and saved
6. **Expected**: Reviewer can view their review

### Expected Reviewer Dashboard Stats

- Assigned Reviews: Number of papers assigned to review
- Submitted Reviews: Number of completed reviews
- Pending Reviews: Papers pending submission
- Can only read papers, submit reviews, cannot modify papers

---

## Editor Testing (Role: Editor)

### Scenario 1: View All Papers

1. Log in as Editor
2. Go to Dashboard
3. **Expected**: Editor Dashboard section shows
4. **Expected**: "Total Submissions" shows all papers in system
5. Click "Manage Papers"
6. **Expected**: Can see all papers (author, reviewer, own)

### Scenario 2: Assign Reviewers

1. Click on a submitted paper
2. Click "Assign Reviewers" or update status
3. Select reviewer(s) from list
4. Change status to "UNDER_REVIEW"
5. Submit
6. **Expected**:
   - Paper status changed to UNDER_REVIEW
   - PaperAccess created for each reviewer with accessLevel='reviewer'
   - Reviewers can now see paper
7. **Verify**: "Under Review" count increases

### Scenario 3: Make Final Decision

1. After reviewers submit reviews
2. Click on paper with reviews
3. Review all reviewer comments
4. Click "Make Decision"
5. Select: ACCEPT/REJECT/REVISION_REQUESTED
6. Add comments
7. Submit
8. **Expected**:
   - Decision created and signed
   - Paper status updated
   - "Decisions Made" count increases

### Expected Editor Dashboard Stats

- Total Submissions: All papers in system
- Pending Review: Papers with SUBMITTED status
- Under Review: Papers with UNDER_REVIEW status
- Decisions Made: Papers with final decisions
- Can view/manage all papers, assign reviewers, make decisions

---

## Database Verification

### Check PaperAccess Records

```javascript
// In MongoDB console or app
// Should see records like:

// Author submits paper:
{
  paperId: ObjectId("..."),
  userId: ObjectId("author_id"),
  accessLevel: "owner",
  status: "ACTIVE",
  grantedBy: ObjectId("author_id"),
  grantReason: "Author - paper owner"
}

// Author grants editor access:
{
  paperId: ObjectId("..."),
  userId: ObjectId("editor_id"),
  accessLevel: "editor",
  status: "ACTIVE",
  grantedBy: ObjectId("author_id"),
  grantReason: "Editor access granted"
}

// Editor assigns reviewer:
{
  paperId: ObjectId("..."),
  userId: ObjectId("reviewer_id"),
  accessLevel: "reviewer",
  status: "ACTIVE",
  grantedBy: ObjectId("editor_id"),
  grantReason: "Assigned as reviewer"
}

// Revoked access:
{
  paperId: ObjectId("..."),
  userId: ObjectId("editor_id"),
  accessLevel: "editor",
  status: "REVOKED",
  revokedAt: ISODate("..."),
  revokedBy: ObjectId("author_id"),
  revocationReason: "Revoked by paper author"
}
```

---

## API Endpoint Testing

### Papers List (Role-Based)

```
GET /api/papers
Response:
- Author: Own papers + papers they have editor access to
- Reviewer: Papers assigned to them
- Editor: All papers
```

### Grant Editor Access

```
POST /api/papers/:paperId/add-editor
Body: { "editorEmail": "editor@example.com" }
Response: PaperAccess record created
```

### Get Paper Editors

```
GET /api/papers/:paperId/editors
Response: Array of editors with active access
```

### Revoke Editor Access

```
DELETE /api/papers/:paperId/revoke-editor
Body: { "editorId": "..." }
Response: PaperAccess status changed to REVOKED
```

---

## Access Control Matrix Verification

| Action                   | Author             | Reviewer       | Editor | Expected                                |
| ------------------------ | ------------------ | -------------- | ------ | --------------------------------------- |
| View own papers          | ✅                 | ❌             | ✅     | Only author sees own                    |
| View assigned papers     | ❌                 | ✅             | ✅     | Reviewers see assigned, editors see all |
| View grant access dialog | ✅                 | ❌             | ❌     | Only authors can grant                  |
| Download paper           | If owner/editor ✅ | If assigned ✅ | ✅     | Based on assignment                     |
| Submit review            | ❌                 | ✅             | ❌     | Only reviewers                          |
| Make decision            | ❌                 | ❌             | ✅     | Only editors                            |
| Assign reviewers         | ❌                 | ❌             | ✅     | Only editors                            |

---

## Common Test Cases

### Test Case 1: Complete Workflow

1. **Author A** submits paper "AI Research"
   - ✅ Paper created
   - ✅ PaperAccess created: author_a, owner
   - ✅ Paper appears in Author A's dashboard

2. **Author A** adds **Author B** as collaborator
   - ✅ PaperAccess created: author_b, editor
   - ✅ Paper appears in Author B's papers list
   - ✅ Collaborator count increased

3. **Editor** assigns **Reviewer A** to paper
   - ✅ Status changed to UNDER_REVIEW
   - ✅ PaperAccess created: reviewer_a, reviewer
   - ✅ Paper appears in Reviewer A's dashboard

4. **Reviewer A** submits review
   - ✅ Review created
   - ✅ Review saved with reviewer ID

5. **Editor** makes decision
   - ✅ Decision created and signed
   - ✅ Status changed to ACCEPTED
   - ✅ All users see updated status

6. **Author A** revokes **Author B** access
   - ✅ PaperAccess status: REVOKED
   - ✅ Paper no longer visible to Author B

---

## Troubleshooting

### Paper Not Appearing

- Check PaperAccess records in database
- Verify user ID matches
- Check access level and status
- Verify /api/papers endpoint returns paper

### Access Denied Error

- Check user's role
- Verify PaperAccess exists and status='ACTIVE'
- Check middleware is properly configured
- Verify session user ID matches

### Modal Not Opening

- Check browser console for JavaScript errors
- Verify modal ID matches link href
- Check CSS display property
- Verify event listeners attached

### Counts Not Updating

- Force page refresh (Ctrl+F5)
- Check /api/papers response in Network tab
- Verify data parsing in JavaScript
- Check for console errors

---

## Success Criteria

### Implementation is Complete When:

✅ **Author Dashboard**

- [x] Submit paper modal works
- [x] Paper count displays correctly
- [x] Manage collaborators modal works
- [x] Can add/remove editors
- [x] Collaborator count accurate

✅ **Reviewer Dashboard**

- [x] Shows only assigned papers
- [x] Can read papers
- [x] Can submit reviews
- [x] Cannot access unassigned papers
- [x] Counts display correctly

✅ **Editor Dashboard**

- [x] Shows all papers
- [x] Can assign reviewers
- [x] Can make decisions
- [x] All counts accurate
- [x] Can see all reviews

✅ **Access Control**

- [x] Authors cannot see others' papers
- [x] Reviewers cannot see unassigned papers
- [x] PaperAccess records created properly
- [x] Access revocation works
- [x] All operations logged

✅ **Database Tracking**

- [x] PaperAccess model exists
- [x] Records created on paper submission
- [x] Records created on editor grant
- [x] Records created on reviewer assign
- [x] Records updated on revocation
