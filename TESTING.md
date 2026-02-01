# Testing Guide - Complete Walkthrough

This guide walks you through the complete signup, email verification, and login workflow with detailed steps and what to expect at each stage.

## Complete User Flow

### Step 1: Navigate to Sign Up

1. **Open the application:** Go to `http://localhost:3000`
2. **Click "Sign Up"** button (or click the "Sign Up" link in the navigation)
3. **You should see:**
   - Page title: "Create Account"
   - Three input fields: Email, Role (dropdown), Password
   - A note about password requirements below the password field
   - A "Create Account" button

---

### Step 2: Fill in the Signup Form

#### Email Field

```
✓ Any valid email works (e.g., author@example.com, reviewer@test.com)
✓ Required field
```

#### Role Selection

Choose one of three roles:

- **Author** - Can create and submit papers for review
- **Collaborator** - Can read papers and issue final decisions
- **Reviewer** - Can read assigned papers and submit reviews

#### Password Field - WITH REAL-TIME VALIDATION

**Requirements (all must be met):**

- ✓ Minimum 12 characters
- ✓ At least one uppercase letter (A-Z)
- ✓ At least one lowercase letter (a-z)
- ✓ At least one digit (0-9)
- ✓ At least one special symbol (!@#$%^&\*()\_+-=[]{};':"\\|,.<>/?)

**What happens as you type:**

1. **While typing (incomplete password):**
   - Input border turns **RED**
   - Text below turns **RED**
   - Shows: "✗ Password must have: 12+ chars, uppercase, lowercase, digits, symbols"

2. **When password becomes valid:**
   - Input border turns **GREEN** ✓
   - Text below turns **GREEN**
   - Shows: "✓ Password meets all requirements"

3. **When field is empty:**
   - Border returns to default color
   - Text returns to gray

---

### Step 3: Click "Create Account"

**What happens:**

1. Form validates the password one more time
2. Button changes to "Creating account..." (disabled)
3. Account is created on the server
4. **Success message appears:**
   ```
   ✓ Sign up successful! You will receive an OTP code at [your@email.com]. Redirecting to verification...
   ```
5. Page automatically redirects to verification page (after 2 seconds)

**If an error occurs:**

- Button re-enables and shows "Create Account" again
- **Error message appears:**
  ```
  ❌ [Error description]
  ```
  Common errors:
  - "Email already in use" - Use a different email
  - "Invalid password format" - Make sure all requirements are met
  - "Missing role" - Select a role from dropdown

---

### Step 4: Verify Email with OTP

**You're now on the verification page:**

- Email field: Pre-filled with your signup email (read-only)
- OTP Code field: Empty, ready for input

#### Finding Your OTP Code

**Option 1: Server Console (Recommended for Testing)**

1. Look at the **terminal where you ran `npm start`**
2. You should see a message like:
   ```
   🔐 OTP for author@example.com: 123456 (expires in 5 minutes)
   ```
3. Copy the 6-digit code (e.g., `123456`)

**Option 2: Browser Console**

1. Open Developer Tools: Press `F12`
2. Go to the "Console" tab
3. Look for OTP-related messages

**Option 3: Email (In Production)**
In a real deployment, you would receive an email with the OTP code.

#### Enter the OTP Code

1. **Click on the OTP Code field**
2. **Type the 6-digit code** (numbers only, spaces are auto-removed)
3. As you type, invalid characters are automatically removed
4. Click **"Verify Email"**

**What happens:**

1. Button changes to "Verifying..."
2. Code is sent to the server
3. **Success message:**
   ```
   ✓ Email verified successfully! Your account is active. Redirecting to login...
   ```
4. Page automatically redirects to login page (after 2 seconds)

**If an error occurs:**

- Button re-enables
- **Error message appears:**
  ```
  ❌ [Error description]
  ```
  Common errors:
  - "Invalid OTP code" - You entered the wrong code (5 attempts allowed)
  - "OTP code has expired" - Code expires after 5 minutes. Sign up again to get a new one.
  - "This OTP code has already been used" - The code was already verified once. Try again if it was a mistake.

---

### Step 5: Login

**You're now on the login page:**

- Email field: Empty
- Password field: Empty
- A "Sign In" button

#### Enter Login Credentials

1. **Email:** Enter the same email you used for signup
2. **Password:** Enter the same password you created during signup
3. Click **"Sign In"**

**What happens:**

1. Button changes to "Signing in..."
2. Credentials are verified on the server
3. **Success message:**
   ```
   ✓ Login successful! Redirecting to your dashboard...
   ```
4. Page automatically redirects to your personal dashboard (after 1.5 seconds)

**If an error occurs:**

- Button re-enables
- **Error message appears:**
  ```
  ❌ [Error description]
  ```
  Common errors:
  - "Invalid email or password" - Check that both are correct
  - "Your account has been locked due to too many failed login attempts. Please try again in 15 minutes." - Account locked after 5 failed attempts. Wait 15 minutes before trying again.

---

### Step 6: Dashboard (Role-Specific)

**After successful login, you see your role-specific dashboard:**

#### As an Author:

- List of your papers (title, owner, collaborators, reviewers, version count)
- Action buttons: View, Submit Review, View Decision
- "Submit New Paper" button

#### As a Collaborator:

- List of papers you're collaborating on
- Shows reviews submitted by reviewers
- Action buttons: View, Issue Decision, View Decision
- "Submit New Paper" button

#### As a Reviewer:

- List of papers assigned to you
- Action buttons: View, Submit Review
- No "Issue Decision" access (read-only)

---

## Password Validation Examples

### ❌ INVALID Passwords (Will show red border)

```
Short123!        ← Only 11 characters (needs 12+)
password123!     ← No uppercase letter
PASSWORD123!     ← No lowercase letter
Password!        ← No digit
Passwords123     ← No special symbol
MyP@ss           ← Only 6 characters
```

### ✅ VALID Passwords (Will show green border)

```
SecurePass123!   ← 13 chars, upper, lower, digit, symbol
MyP@ssw0rd       ← 10 chars... wait, this is 10, needs 12
MySecure@Pass22  ← 14 chars, upper, lower, digits, symbol ✓
Test#Secure99    ← 13 chars, upper, lower, digits, symbol ✓
P@ssw0rd2024     ← 14 chars, upper, lower, digits, symbol ✓
```

---

## Troubleshooting

### Issue: "Form clears but doesn't proceed"

**Solution:** Check for error messages below the form. Make sure:

- All required fields are filled
- Password meets all requirements (look for the GREEN border)
- Email is in valid format
- Role is selected

### Issue: "Can't find the OTP code"

**Solution:** Look at the terminal window running the server. You should see:

```
🔐 OTP for [email]: [code] (expires in 5 minutes)
```

### Issue: "OTP code doesn't work"

**Solution:**

- Check you entered the exact same 6 digits shown in the server console
- Make sure the code hasn't expired (5-minute window)
- You only get 5 attempts before being locked out
- If locked out, sign up again to get a new OTP

### Issue: "Login keeps failing"

**Solution:**

- Double-check email and password are exactly correct
- Account might be locked (5 failed attempts = 15-minute lockout)
- Password is case-sensitive

### Issue: "Button disabled and says 'Creating account...' but nothing happens"

**Solution:** This usually means:

- The form is waiting for the server to respond
- Check that the server is running (`npm start`)
- Check browser console (F12) for any JavaScript errors
- Check that `http://localhost:3000` is accessible

---

## Test Scenarios

### Scenario 1: Successful Complete Flow

1. Sign up with email `author@example.com`, role `Author`, password `SecurePass123!`
2. Copy OTP from server console
3. Enter OTP on verification page
4. Login with same credentials
5. ✓ See Author dashboard

### Scenario 2: Test Password Validation

1. Go to signup page
2. Type password `test` - See red border
3. Type `Test1234` - Still red (no symbol)
4. Type `Test1234!` - Still red (less than 12 chars)
5. Type `Test1234!xyz` - Now green! ✓
6. Clear field - Back to normal
7. Type invalid again - Red again

### Scenario 3: Test Account Lockout

1. Go to login page
2. Try to login 5 times with wrong password
3. On 5th attempt, see error: "account locked"
4. Try to login again - See: "Your account has been locked... try again in 15 minutes"
5. Wait 15 minutes (or just acknowledge the security feature works)

### Scenario 4: Test OTP Expiry

1. Sign up and note the OTP code and time
2. Wait 5+ minutes
3. Try to verify OTP
4. See error: "OTP code has expired"
5. Sign up again to get a new OTP

---

## Security Features You're Testing

✓ **Password Validation** - Only strong passwords are accepted
✓ **Email Verification** - OTP prevents fake email signup
✓ **Account Lockout** - Brute-force protection
✓ **OTP Single-Use** - Can't reuse the same code twice
✓ **OTP Expiry** - Codes expire after 5 minutes
✓ **Secure Sessions** - Login creates authenticated session
✓ **CSRF Protection** - All forms use CSRF tokens
✓ **Rate Limiting** - Limited requests per time period
✓ **Encryption** - All papers and reviews are encrypted
✓ **Digital Signatures** - Final decisions are cryptographically signed

---

## Next Steps After Login

Once logged in with an Author account, you can:

1. **Submit a paper** - Create a new research paper with encryption
2. **Invite collaborators** - Add other users to collaborate
3. **Invite reviewers** - Request peer reviews
4. **View reviews** - Decrypt and read reviewer feedback
5. **View decision** - See final decision with signature verification

---

## Still Having Issues?

1. **Check the server is running:**

   ```powershell
   npm start
   ```

   You should see: `Server running on port 3000`

2. **Clear browser cache:**
   - Press `Ctrl+Shift+Delete` and clear cache

3. **Check Developer Tools (F12):**
   - Look at Console tab for JavaScript errors
   - Look at Network tab to see API requests/responses

4. **Check data.json:**
   - Should contain users, otps, papers, reviews, logs
   - This is the database file (file-backed storage)
