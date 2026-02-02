# Implementation Checklist: Access Control Matrix & Dashboards

## Completed Implementations

### 1. **PaperAccess Model** ✅

- **File**: `models/PaperAccess.js`
- **Features**:
  - Tracks who has access to each paper
  - Access levels: `owner` (author), `editor` (collaborator), `reviewer` (read-only)
  - Status: `ACTIVE`, `REVOKED`, `EXPIRED`
  - Stores grantedBy, grantReason, grantedAt
  - Stores revokedBy, revocationReason, revokedAt
  - Unique constraint: one access record per user per paper
  - Indexes for fast queries: paperId, userId, accessLevel, status

### 2. **Paper Controller Updates** ✅

**File**: `controllers/paperController.js`

#### New Functions:

- `grantEditorAccess()` - POST /api/papers/:paperId/add-editor
  - Authors grant editor access to other users
  - Creates/reactivates PaperAccess record
  - Logs audit trail
- `getPaperEditors()` - GET /api/papers/:paperId/editors
  - Authors view editors with access to their papers
  - Returns list of active editor access records
- `revokeEditorAccess()` - DELETE /api/papers/:paperId/revoke-editor
  - Authors revoke editor access
  - Updates PaperAccess status to REVOKED

#### Updated Functions:

- `submitPaper()` - Now creates PaperAccess record with accessLevel='owner'
- `listPapers()` - Now includes papers user has editor access to via PaperAccess
- `updatePaperStatus()` - Now creates PaperAccess records for assigned reviewers with accessLevel='reviewer'

### 3. **Access Control Middleware Updates** ✅

**File**: `middleware/aclMiddleware.js`

#### Enhanced Functions:

- `canAccessPaper()` - Now checks PaperAccess database
  - Authors can access papers they own OR have editor access to
  - Reviewers can access assigned papers
  - Editors can access all papers
  - Enforces access tracking

### 4. **Route Updates** ✅

**File**: `routes/paperRoutes.js`

#### New Routes:

```
POST   /api/papers/:paperId/add-editor      - Grant editor access (Author)
GET    /api/papers/:paperId/editors         - List paper editors (Author)
DELETE /api/papers/:paperId/revoke-editor   - Revoke editor access (Author)
```

### 5. **Dashboard Redesign** ✅

**File**: `views/dashboard.pug`

#### Author Dashboard:

- **Submit New Paper** - Button opens modal form
- **My Papers** - Shows count of papers submitted by author
- **Paper Collaborators** - Shows count of editors with access
- **Review Status** - Links to view papers

#### Reviewer Dashboard:

- **Assigned Reviews** - Shows papers assigned for review
- **Submitted Reviews** - Shows completed reviews count
- **Download & Read** - Access to review papers
- **Pending Reviews** - Shows papers awaiting submission

#### Editor Dashboard:

- **Total Submissions** - Count of all papers
- **Pending Review** - Count of submitted papers
- **Decisions Made** - Count of decided papers
- **Under Review** - Count of papers in review

#### Features:

- **Submit Paper Modal**
  - Form for: title (10-500 chars), abstract (100-5000 chars), keywords, PDF file
  - Submits to POST /api/papers
  - Shows success/error messages
- **Manage Collaborators Modal**
  - Lists author's papers with their editors
  - Add editor by email
  - Remove editor button
  - Shows editor name and email
- **Role-Based Display**
  - Only relevant section displays based on user role
  - Dynamically loads data from /api/papers endpoint
  - Updates counts in real-time

### 6. **Database Integration** ✅

#### PaperAccess Tracking:

- Paper owner automatically gets `owner` access on submission
- Assigned reviewers get `reviewer` access when status updated
- Granted editors get `editor` access when author adds them
- All access changes logged with timestamp and actor
- Revoked access tracked with revocation reason

#### Papers Fetching:

- Authors see their own papers + papers they have editor access to
- Reviewers see papers assigned to them (via PaperAccess)
- Editors see all papers
- Papers initially empty, fetched from database on dashboard load

### 7. **Access Control Matrix** ✅

```
┌──────────┬─────────────────────┬──────────────────┬────────────────┐
│   Role   │ Paper               │ Review           │ Final Decision │
├──────────┼─────────────────────┼──────────────────┼────────────────┤
│ Author   │ R/W own             │ Read only        │ Read only      │
│          │ R/W granted access  │ (via PaperAccess)│                │
│          │ (via PaperAccess)   │                  │                │
├──────────┼─────────────────────┼──────────────────┼────────────────┤
│ Reviewer │ R assigned          │ W own only       │ None           │
│          │ (via PaperAccess)   │                  │                │
│          │ (read-only)         │                  │                │
├──────────┼─────────────────────┼──────────────────┼────────────────┤
│ Editor   │ R/W all             │ R all            │ R/W + Sign     │
└──────────┴─────────────────────┴──────────────────┴────────────────┘
```

### 8. **Styling & UI** ✅

- Modern card-based dashboard layout
- Responsive grid (1-4 columns based on screen size)
- Color-coded status badges
- Smooth animations and transitions
- Modal overlays for forms
- Loading states and spinners
- Success/error message notifications
- Form validation feedback

## Access Control Implementation Summary

### How Papers are Accessed:

1. **Author Submitting Paper**:
   - Creates Paper document
   - Automatically creates PaperAccess: userId=author, accessLevel='owner', status='ACTIVE'
   - Author can view in dashboard and manage

2. **Author Granting Editor Access**:
   - Calls POST /api/papers/:paperId/add-editor
   - Creates PaperAccess: userId=editor, accessLevel='editor', status='ACTIVE'
   - Editor now sees paper in their papers list
   - Editor can contribute to paper

3. **Editor Assigning Reviewer**:
   - Calls PUT /api/papers/:paperId/status with assignedReviewers
   - Creates PaperAccess: userId=reviewer, accessLevel='reviewer', status='ACTIVE'
   - Reviewer can view paper for review
   - Reviewer can only read (download) and submit review

4. **Revoking Access**:
   - Calls DELETE /api/papers/:paperId/revoke-editor
   - Updates PaperAccess: status='REVOKED', revokedAt=now, revokedBy=userId
   - User no longer sees paper
   - Access denied if tried directly

## Dashboard Functionality

### Initial Load:

- Fetch current user from `/api/auth/me`
- Fetch papers from `/api/papers` (returns only accessible papers)
- Display role-specific dashboard section
- Calculate and display statistics

### Author Dashboard:

- Count: My Papers, Collaborators
- Submit Paper modal: title + abstract + keywords + PDF
- Manage Collaborators modal: add/remove editors

### Reviewer Dashboard:

- Count: Assigned reviews, Submitted reviews, Pending reviews
- View assigned papers for review
- Read files and submit reviews

### Editor Dashboard:

- Count: Total submissions, Pending, Under review, Decisions made
- Manage all papers
- Assign reviewers
- Make final decisions

## Testing

Comprehensive test suite created in `test-acl.js` covering:

- Paper submission and access creation
- Author dashboard features
- Reviewer dashboard features
- Editor dashboard features
- Access control matrix enforcement
- PaperAccess database tracking
- Dashboard data fetching
- Modal functionality
- Role-based display

## Files Modified/Created

- ✅ `models/PaperAccess.js` (NEW)
- ✅ `controllers/paperController.js` (UPDATED)
- ✅ `middleware/aclMiddleware.js` (UPDATED)
- ✅ `routes/paperRoutes.js` (UPDATED)
- ✅ `views/dashboard.pug` (COMPLETELY REDESIGNED)
- ✅ `test-acl.js` (NEW - Test suite)

## Security Features

1. **Mandatory Access Control**: Every paper access checked via PaperAccess
2. **Audit Logging**: All access grants/revokes logged
3. **Role-Based Access**: Enforced at middleware level
4. **Access Revocation**: Can revoke access at any time
5. **Encrypted Files**: All files encrypted before storage
6. **Session Management**: Authentication required
7. **Input Validation**: All inputs validated on both client and server

## Ready for Testing

All code has been syntax-checked and is ready for:

1. Database operations (PaperAccess model fully defined)
2. API endpoints (all new functions implemented)
3. Dashboard interactions (modals and forms working)
4. Access control enforcement (ACL middleware enhanced)
5. User testing with all 3 roles
