# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  ┌──────────────┬──────────────┬──────────────────────────────┐ │
│  │ Author       │  Reviewer    │  Editor Dashboard            │ │
│  │ Dashboard    │  Dashboard   │                              │ │
│  └──────────────┴──────────────┴──────────────────────────────┘ │
│         ↓              ↓                ↓                         │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │            JavaScript (Form & Modal Handling)               │ │
│  │  - Fetch /api/papers (role-filtered)                       │ │
│  │  - Submit paper modal                                      │ │
│  │  - Manage collaborators modal                              │ │
│  │  - Real-time stat updates                                  │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                          ↓
        ┌─────────────────────────────────────────┐
        │         API LAYER (Express)              │
        ├─────────────────────────────────────────┤
        │  Authentication Middleware               │
        │  - Check session                         │
        │  - MFA verification                      │
        │  - User info refresh                     │
        └─────────────────────────────────────────┘
                          ↓
        ┌─────────────────────────────────────────┐
        │      ACL Middleware (Authorization)      │
        ├─────────────────────────────────────────┤
        │  canAccessPaper()                        │
        │  - Check user role                       │
        │  - Query PaperAccess from DB             │
        │  - Enforce access control                │
        │  - Log unauthorized attempts             │
        │                                          │
        │  canAccessReview()                       │
        │  canAccessDecision()                     │
        └─────────────────────────────────────────┘
                          ↓
        ┌─────────────────────────────────────────┐
        │       CONTROLLERS (Business Logic)       │
        ├─────────────────────────────────────────┤
        │  paperController:                        │
        │  - submitPaper()      [Creates paper]    │
        │  - listPapers()       [Role-filtered]    │
        │  - getPaper()         [ACL checked]      │
        │  - downloadPaper()    [Decrypt & log]    │
        │  - updatePaperStatus()[Assign reviewers] │
        │  - grantEditorAccess()[New]              │
        │  - getPaperEditors()  [New]              │
        │  - revokeEditorAccess()[New]             │
        │                                          │
        │  reviewController: (review management)   │
        │  decisionController: (editorial decisions│
        │  authController: (user auth)             │
        └─────────────────────────────────────────┘
                          ↓
        ┌─────────────────────────────────────────┐
        │       SERVICE LAYER                      │
        ├─────────────────────────────────────────┤
        │  cryptoService: File encryption/decrypt  │
        │  auditService: Logging & monitoring      │
        │  emailService: Notifications             │
        └─────────────────────────────────────────┘
                          ↓
        ┌─────────────────────────────────────────┐
        │      DATA LAYER (MongoDB)                │
        ├─────────────────────────────────────────┤
        │  Collections:                            │
        │  ├─ User (auth & role)                   │
        │  ├─ Paper (document storage)             │
        │  ├─ Review (peer reviews)                │
        │  ├─ Decision (final decisions)           │
        │  ├─ PaperAccess (access tracking) [NEW]  │
        │  ├─ AuditLog (security logging)          │
        │  └─ Session (user sessions)              │
        └─────────────────────────────────────────┘
```

## Data Flow Diagram: Paper Access

```
┌─────────────────────────────────────────────────────────────────┐
│                    PAPER SUBMISSION FLOW                         │
└─────────────────────────────────────────────────────────────────┘

Author Browser                   Server                    Database
    │                              │                           │
    ├─ Submit Paper Form ─────────→│                           │
    │                              │                           │
    │                              ├─ Validate Input           │
    │                              ├─ Encrypt File             │
    │                              ├─ Create Paper Doc ───────→│
    │                              │                    Paper  │
    │                              │                           │
    │                              ├─ Create PaperAccess ────→│
    │                              │                    (owner)│
    │                              │                           │
    │                              ├─ Log Audit Trail ────────→│
    │                              │                  AuditLog │
    │                              │                           │
    │←─ Success Response ──────────│                           │
    │                              │                           │
    └─ Refresh Dashboard ─────────→│                           │
                                   ├─ GET /api/papers ────────→│
                                   │  Query: {authorId: user}  │
                                   │←─ [paper] ───────────────│
                                   │                           │
                                   ├─ GET PaperAccess────────→│
                                   │  (editor access papers)   │
                                   │←─ [access_records] ──────│
    │←─ Updated Stats ───────────│                           │
    │                              │                           │
```

```
┌─────────────────────────────────────────────────────────────────┐
│              EDITOR ACCESS GRANT FLOW                            │
└─────────────────────────────────────────────────────────────────┘

Author Browser               Server                     Database
    │                          │                           │
    ├─ Click "Add Editor"─────→│                           │
    │   with email             │                           │
    │                          ├─ Validate author ─→Check │
    │                          │                Paper.authorId│
    │                          │                           │
    │                          ├─ Find user ───────────────→│
    │                          │  by email        User.find │
    │                          │←───────────────────────────│
    │                          │                           │
    │                          ├─ Create PaperAccess ─────→│
    │                          │  accessLevel: 'editor'    │
    │                          │  status: 'ACTIVE'         │
    │                          │  grantedBy: author_id     │
    │                          │                           │
    │                          ├─ Log Audit ───────────────→│
    │                          │                  AuditLog  │
    │                          │                           │
    │←─ Success Response ──────│                           │
    │                          │                           │
    └─ Update List ────────────→│                           │
                                ├─ GET editors ────────────→│
                                │  for this paper    Query  │
                                │←──────────────────────────│
    │←─ Editor List ─────────────│                           │
    │                          │                           │

Note: Editor now sees paper in their /api/papers list
because canAccessPaper() checks PaperAccess.accessLevel
```

```
┌─────────────────────────────────────────────────────────────────┐
│          REVIEWER ASSIGNMENT & ACCESS FLOW                       │
└─────────────────────────────────────────────────────────────────┘

Editor Browser              Server                      Database
    │                          │                           │
    ├─ Select Reviewers ──────→│                           │
    │  & Assign Paper          │                           │
    │                          ├─ Update paper status ────→│
    │                          │  status: 'UNDER_REVIEW'   │
    │                          │  assignedReviewers: [...]│
    │                          │                           │
    │                          ├─ For each reviewer:       │
    │                          │  Create PaperAccess ─────→│
    │                          │  accessLevel: 'reviewer' │
    │                          │  status: 'ACTIVE'         │
    │                          │  grantedBy: editor_id     │
    │                          │                           │
    │                          ├─ Log Audit ──────────────→│
    │                          │                  AuditLog │
    │←─ Success Response ──────│                           │
    │                          │                           │

Reviewer Browser            Server                      Database
    │                          │                           │
    ├─ Load Dashboard ─────────→│                           │
    │                          ├─ GET /api/papers ────────→│
    │                          │  Query: (based on role)  │
    │                          │  assignedReviewers: this │
    │                          │←─ [assigned_papers] ─────│
    │                          │                           │
    │←─ Show Papers ─────────────│                           │
    │ (from assignment)          │                           │
    │                          │                           │
    ├─ Click Paper ────────────→│                           │
    │                          ├─ canAccessPaper() ──────→│
    │                          │  Check PaperAccess       │
    │                          │←──────────────────────────│
    │                          │  → accessLevel='reviewer' │
    │←─ Can Download & Review ───│                           │
    │                          │                           │
```

## Access Control Check Flow

```
REQUEST: GET /api/papers/:paperId

Router receives request
    ↓
authMiddleware.isAuthenticated
  - Check session valid
  - Check mfaVerified
  - Get userId
    ↓
aclMiddleware.canAccessPaper
  ├─ Get paperId from params
  ├─ Get userId from session
  ├─ Get user.role from session
  │
  ├─ IF role === 'Editor'
  │   └─ Access granted (full)
  │
  ├─ ELSE IF role === 'Author'
  │   ├─ IF paper.authorId === userId
  │   │   └─ Access granted (owner)
  │   │
  │   └─ ELSE
  │       ├─ Query PaperAccess where:
  │       │  - paperId = paperId
  │       │  - userId = userId
  │       │  - accessLevel = 'editor'
  │       │  - status = 'ACTIVE'
  │       │
  │       ├─ IF found
  │       │   └─ Access granted (editor)
  │       │
  │       └─ ELSE
  │           ├─ Log access denied
  │           └─ Return 403 Forbidden
  │
  └─ ELSE IF role === 'Reviewer'
      ├─ IF paper.assignedReviewers includes userId
      │   └─ Access granted (read-only)
      │
      └─ ELSE
          ├─ Log access denied
          └─ Return 403 Forbidden
    ↓
Controller receives request
    ↓
Response sent to client
```

## Database Schema

```
User Collection
├─ _id: ObjectId
├─ fullName: String
├─ email: String (unique)
├─ username: String (unique)
├─ passwordHash: String
├─ role: 'Author' | 'Reviewer' | 'Editor'
├─ mfaEnabled: Boolean
└─ ... other fields

Paper Collection
├─ _id: ObjectId
├─ title: String
├─ abstractText: String
├─ keywords: [String]
├─ fileName: String
├─ fileSize: Number
├─ encryptedData: String
├─ encryptedIV: String
├─ encryptedAESKey: String
├─ fileHash: String
├─ authorId: ObjectId (ref: User)
├─ authorEmail: String
├─ status: 'SUBMITTED' | 'UNDER_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'REVISION_REQUESTED'
├─ assignedReviewers: [ObjectId] (ref: User)
├─ finalDecision: ObjectId (ref: Decision)
├─ submittedAt: Date
├─ updatedAt: Date
└─ reviewDeadline: Date

PaperAccess Collection [NEW]
├─ _id: ObjectId
├─ paperId: ObjectId (ref: Paper)
├─ userId: ObjectId (ref: User)
├─ accessLevel: 'owner' | 'editor' | 'reviewer'
├─ status: 'ACTIVE' | 'REVOKED' | 'EXPIRED'
├─ grantedBy: ObjectId (ref: User)
├─ grantReason: String
├─ grantedAt: Date
├─ expiresAt: Date
├─ revokedAt: Date
├─ revokedBy: ObjectId (ref: User)
├─ revocationReason: String
├─ createdAt: Date
├─ updatedAt: Date
└─ Indexes:
   - Unique: paperId + userId
   - Regular: paperId, userId, accessLevel, status

Review Collection
├─ _id: ObjectId
├─ paperId: ObjectId (ref: Paper)
├─ reviewerId: ObjectId (ref: User)
├─ reviewerEmail: String
├─ summary: String
├─ strengths: String
├─ weaknesses: String
├─ suggestions: String
├─ rating: 1-5
├─ recommendation: 'ACCEPT' | 'MINOR_REVISION' | 'MAJOR_REVISION' | 'REJECT'
├─ status: 'PENDING' | 'SUBMITTED' | 'COMPLETED'
├─ submittedAt: Date
├─ createdAt: Date
└─ updatedAt: Date

Decision Collection
├─ _id: ObjectId
├─ paperId: ObjectId (ref: Paper)
├─ editorId: ObjectId (ref: User)
├─ status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'REVISION_REQUESTED'
├─ comments: String
├─ signature: String (RSA-PSS digital signature)
├─ createdAt: Date
└─ updatedAt: Date

AuditLog Collection
├─ _id: ObjectId
├─ userId: ObjectId (ref: User)
├─ action: String
├─ resourceId: ObjectId
├─ result: 'SUCCESS' | 'FAILED' | 'DENIED'
├─ details: String
├─ clientIP: String
├─ timestamp: Date
└─ Indexes:
   - userId, action, timestamp
   - resourceId, timestamp
```

## Role Capabilities Matrix

```
┌──────────────────┬────────┬──────────┬────────┐
│ Capability       │ Author │ Reviewer │ Editor │
├──────────────────┼────────┼──────────┼────────┤
│ View own papers  │   ✓    │    ✗     │   ✓    │
│ View all papers  │   ✗    │    ✗     │   ✓    │
│ View assigned    │   ✗    │    ✓     │   ✓    │
│ Download paper   │   ✓    │    ✓     │   ✓    │
│ Submit paper     │   ✓    │    ✗     │   ✗    │
│ Grant access     │   ✓    │    ✗     │   ✗    │
│ Revoke access    │   ✓    │    ✗     │   ✗    │
│ Assign reviewer  │   ✗    │    ✗     │   ✓    │
│ Submit review    │   ✗    │    ✓     │   ✗    │
│ View reviews     │   ✗    │    ✓     │   ✓    │
│ Make decision    │   ✗    │    ✗     │   ✓    │
└──────────────────┴────────┴──────────┴────────┘
```

## API Endpoints by Role

```
AUTHOR ENDPOINTS
POST   /api/papers                    - Submit paper
GET    /api/papers                    - View own + editor access papers
GET    /api/papers/:id                - Get paper details (own/access)
GET    /api/papers/:id/download       - Download paper PDF
POST   /api/papers/:id/add-editor     - Grant editor access
GET    /api/papers/:id/editors        - List editors
DELETE /api/papers/:id/revoke-editor  - Revoke editor access

REVIEWER ENDPOINTS
GET    /api/papers                    - View assigned papers
GET    /api/papers/:id                - Get assigned paper details
GET    /api/papers/:id/download       - Download paper PDF
POST   /api/papers/:id/reviews        - Submit review
GET    /api/papers/:id/reviews        - View reviews (own)

EDITOR ENDPOINTS
GET    /api/papers                    - View all papers
GET    /api/papers/:id                - Get any paper
POST   /api/papers/:id/reviews        - (view reviews)
GET    /api/papers/:id/reviews        - View all reviews
PUT    /api/papers/:id/status         - Assign reviewers
POST   /api/papers/:id/decision       - Make decision
GET    /api/papers/:id/decision       - View decision

ALL ROLES
POST   /api/auth/login                - Login
POST   /api/auth/logout               - Logout
POST   /api/auth/verify-mfa           - MFA verification
GET    /api/auth/me                   - Get current user
```

This architecture ensures:

- ✅ Secure access control at every level
- ✅ Database-backed authorization
- ✅ Complete audit trail
- ✅ Scalable and maintainable design
- ✅ Proper separation of concerns
- ✅ Comprehensive logging and monitoring
