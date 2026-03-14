

# Secure Digital Product Viewer — "The Digital Vault"

## Overview
A secure web application for selling controlled, time-limited access to digital products. Admins upload files and generate access codes; customers use codes to view content with watermark protection and anti-download measures.

---

## Phase 1: Foundation & Database

### Supabase Setup
- **Auth**: Single admin account with hardcoded email + password login
- **Database tables**:
  - `access_codes` — code, timer_duration, status (active/expired/revoked), activated_at, expires_at
  - `files` — filename, filetype, storage_path, metadata
  - `code_file_mappings` — links codes to files
  - `viewer_sessions` — code_id, session_start, session_expiry, activity log
- **Storage bucket**: `digital-products` (private, accessible only via edge functions)
- **RLS policies**: Admin-only write access, viewer read via session validation

---

## Phase 2: Admin Dashboard (`/admin`)

### Design
- Deep navy sidebar with navigation (Dashboard, Files, Codes)
- Off-white slate main content area with card-based layout
- Inter font throughout, status badges (emerald = active, crimson = expired/revoked)

### Features
1. **Login page** — Email/password auth, redirect to dashboard
2. **File Management** — Upload files (PDF, images, video, Word/Excel) to Supabase Storage, view/delete files, edit metadata
3. **Code Generator** — Generate cryptographically secure 16-24 char codes, set timer duration (minutes/hours/days), assign files to codes
4. **Code Management Table** — List all codes with status, linked files, timer info, and revoke button
5. **Dashboard overview** — Active codes count, total files, recent activity

---

## Phase 3: Viewer Access Page (`/view`)

### Design
- Centered minimal "gate" layout for code entry
- After activation: full-width viewer with slim top bar showing countdown timer and "Close Session" button

### Flow
1. **Code Entry** — Input field + "Verify Code" button with rate limiting
2. **Validation** — Check code validity via edge function; show "View Content" button if valid
3. **Timer Activation** — Timer starts server-side ONLY when "View Content" is clicked
4. **Content Display** — Secure viewers for each file type
5. **Session Expiry** — Auto-revoke access when timer ends; page refresh preserves timer state

---

## Phase 4: Secure Content Delivery

### Edge Functions
1. **`validate-code`** — Verify code, return status, handle rate limiting
2. **`activate-session`** — Start timer, create session record
3. **`serve-file`** — Stream files through authenticated endpoint (no direct URLs)
4. **`watermark-pdf`** — Server-side PDF watermarking with access code, session ID, timestamp

### Content Viewers
- **PDF**: pdf.js-based viewer with disabled download/print, server-side watermark injection
- **Images**: Canvas-based renderer with watermark overlay (access code + timestamp at 45° angle, 30% opacity)
- **Video**: HTML5 player with watermark overlay, no download controls
- **Word/Excel**: Convert to PDF via edge function, then render in PDF viewer

---

## Phase 5: Content Protection

### Client-Side Protections
- Disable right-click context menu
- Disable text selection on content areas
- Block keyboard shortcuts (Ctrl+S, Ctrl+P, Ctrl+C, Ctrl+Shift+I)
- Custom thin scrollbars
- No exposed file URLs

### Watermarking
- **PDFs**: Server-side watermark injection before streaming (code + session ID + timestamp)
- **Images/Video**: Client-side canvas/overlay watermark at 45° angle, repeated pattern, 30% opacity

### Session Security
- Server-side timer validation on every request
- Automatic session expiry
- Activity logging (views, attempts)
- Rate limiting on code entry (prevent brute force)

---

## Key UX Details
- **Timer display**: Always visible in top bar; subtle pulse animation in final 60 seconds
- **Responsive**: Works on desktop and mobile
- **Error states**: Clear messages for invalid codes, expired sessions, revoked access
- **Instant feedback**: Snappy validation responses, no decorative animations

