# Build Prompt: Universal File Converter (for Google Antigravity)

Paste everything below into Antigravity as your task/mission prompt. It's written directly to the agent in imperative form so it can plan, build, and self-verify in one pass. Feel free to trim sections if you want to ship an MVP first (see "Phased Build Plan" at the end).

---

## PROMPT START

You are an expert full-stack engineer building a production-grade **universal file converter web application** — the same category of product as iLovePDF, CloudConvert, and Convertio, but not limited to PDFs: it must convert *any* supported file type to *any* other compatible type. Free/anonymous users can convert files up to 350MB; anything larger, **regardless of file type** (document, PDF, image, video, audio, archive, etc.), requires signing up/logging in and subscribing. Subscribed users can go up to the app's general ceiling (1GB+, see Section 3). The whole experience must have a best-in-class responsive UI on desktop, tablet, and mobile.

Build the entire application end-to-end: frontend, backend, conversion pipeline, job queue, storage, and deployment config. Plan first, then implement, then test the critical flows (upload → convert → download) in the browser before declaring done.

### 1. Product Vision

A single-page web app where a user can:
- Drag & drop (or select) one or more files of virtually any type.
- Pick a target format from a smart, filtered list of valid conversions for that file type.
- Convert instantly for small files, or track background progress for large files.
- Download the result individually or as a zip for batch jobs.
- Trust that **nothing is retained**: both the original upload and the converted output are permanently deleted from storage the moment they're no longer needed — immediately after a successful download, or automatically within minutes if the user never downloads.

### 2. Supported Conversion Categories

Implement a **conversion engine registry** that maps input MIME/extension → list of valid output formats, backed by real conversion libraries (not stubs). Cover at least these categories:

| Category | Examples | Suggested engine/library |
|---|---|---|
| Documents | PDF, DOCX, DOC, ODT, RTF, TXT, Markdown, HTML | LibreOffice headless (`soffice --headless --convert-to`), Pandoc |
| Spreadsheets | XLSX, XLS, ODS, CSV, TSV | LibreOffice headless, SheetJS |
| Presentations | PPTX, PPT, ODP | LibreOffice headless |
| Images | JPG, PNG, WEBP, GIF, TIFF, BMP, SVG, HEIC, AVIF | `sharp` (Node) or Pillow/`libvips` (Python), `imagemagick` for edge formats |
| Audio | MP3, WAV, FLAC, AAC, OGG, M4A | FFmpeg |
| Video | MP4, MOV, AVI, MKV, WEBM, GIF (video→gif) | FFmpeg (with hardware-accel flags where available) |
| Archives | ZIP, RAR (extract only), 7Z, TAR, GZ | `7-zip`, `node-tar`, `archiver` |
| Ebooks | EPUB, MOBI, AZW3, PDF | Calibre `ebook-convert` CLI |
| Fonts | TTF, OTF, WOFF, WOFF2 | `fonttools`, `sfnt2woff` |
| CAD/Vector (stretch) | SVG, DXF, EPS | Inkscape CLI |

Design this registry so adding a new format is a config change, not a rewrite — e.g., a `conversions.json`/`conversions.ts` mapping `{ from: "docx", to: ["pdf","odt","txt","html"], engine: "libreoffice" }`.

### 3. Large File Handling (critical — must support 1GB+ uploads reliably for subscribed users)

This infrastructure applies once a user is past the 350MB free ceiling (Section 8) and has an active subscription — but build it generally, since even free-tier files up to 350MB benefit from the same resumable/streaming approach. Do **not** rely on a single HTTP POST for the whole file. Implement:

- **Chunked, resumable uploads** on the client (e.g., the `tus` protocol via `tus-js-client` + a `tus` server, or a custom chunked-upload endpoint with `Content-Range`). Chunk size ~5–10MB, with retry-on-failure per chunk and resume-after-refresh support.
- **Streaming, not buffering**: the backend must stream chunks directly to disk/object storage rather than holding the full file in memory (use Node streams / Python generators, never `fs.readFileSync` on the whole upload).
- **Background job processing**: once upload completes, enqueue a conversion job (Redis + BullMQ, or Celery + Redis/RabbitMQ if Python) instead of converting synchronously in the request handler. Conversion workers run as separate scalable processes/containers.
- **Real-time progress**: push upload % and conversion % to the client via WebSockets or Server-Sent Events, not polling — show a live progress bar with stage labels ("Uploading… Converting… Finalizing…").
- **Object storage for large payloads**: store originals/outputs in S3-compatible storage (S3, R2, or MinIO for local dev), not the app server's disk, so the app scales horizontally.
- **Timeouts & limits**: configurable max file size (default 2GB, warn at 1GB), sane worker timeouts scaled to file size, and graceful error messages (not silent failures) if a conversion exceeds limits.
- **Zero-retention deletion policy** (nothing is stored longer than necessary — true zero-persistence at the byte level isn't possible since conversion requires the file to sit in storage briefly, but treat every stored byte as strictly transient):
  1. **Delete the original immediately after conversion succeeds** — as soon as the worker confirms the output file is written, delete the source upload right away. Never wait for the user to download before clearing the input file.
  2. **Delete-on-download for the output**: don't serve the converted file from a long-lived public URL. Proxy the download through your own backend endpoint (stream from storage → response stream), and as soon as the stream finishes (or the client disconnects), delete the output file from storage in the same request lifecycle. This gives you a reliable "download complete → delete" trigger instead of guessing.
  3. **Single-use download link**: the download URL/token should only work once. A second request to the same link should 404, not re-serve a cached copy.
  4. **Safety-net sweep**: still run a scheduled cleanup (cron / queue-based) that force-deletes any file older than a short hard cap (e.g., 15–30 minutes) regardless of download status — this catches abandoned jobs, failed deletes, and users who never come back for their file.
  5. **If conversion fails**: delete both the original and any partial output immediately; don't leave failed-job artifacts sitting in storage.
  6. Never log or persist file *contents* anywhere (no copies in logs, caches, or backups) — the database only ever stores job metadata (filenames, formats, status, timestamps), never file bytes.

### 4. Suggested Tech Stack

- **Frontend**: React + TypeScript (Next.js or Vite), Tailwind CSS, shadcn/ui or Radix primitives for accessible components, Framer Motion for micro-interactions, `tus-js-client` or Uppy for resumable uploads.
- **Database**: **Supabase (Postgres)** — `jobs` table only stores metadata (filename, source/target format, status, storage path, created_at). Never store file bytes in the DB. Must be on the **Pro plan or higher** (Free plan caps files at 50MB, which is incompatible with 1GB+ uploads).
- **File storage**: **Supabase Storage**, using its native **TUS resumable upload support** (point `tus-js-client`/Uppy at the Supabase Storage TUS endpoint — don't build a custom chunking server). Raise the global file size limit in Storage Settings to match your app's max (e.g., 2GB). Treat every bucket as scratch space only — see the zero-retention policy in Section 3.
- **Backend**: Node.js (Fastify) or Python (FastAPI) as a thin API layer for job creation, status, and the proxied download-then-delete endpoint. Deployed separately from Supabase (Fly.io/Render/Cloud Run).
- **Queue/Workers**: Redis + BullMQ (Node) or Redis + Celery (Python), run as their own service — Supabase does **not** run FFmpeg/LibreOffice for you, so the actual conversion must happen on your own worker containers, which read from and write back to Supabase Storage.
- **Real-time progress**: use **Supabase Realtime** (listen to changes on the `jobs` table) instead of standing up your own WebSocket server — the worker updates job status/progress in Postgres, and Realtime pushes it to the client automatically.
- **Conversion engines**: install and shell out to LibreOffice, FFmpeg, Calibre, ImageMagick/libvips inside worker containers (document exact Dockerfile install steps).
- **Auth & payments**: **Supabase Auth** (email magic link/OTP) for login/signup, **Stripe** (Checkout + Billing) for the subscription that unlocks >350MB photo/video uploads. Verify subscription status server-side via a Stripe webhook writing to a `subscriptions` table in Supabase, not just a client-side flag.
- **Infra**: Docker Compose for local dev (app, worker, redis — Supabase itself can run locally via the Supabase CLI); a Dockerfile per service; workers deployed as an always-on service since conversion is too heavy for serverless functions.

### 5. UI/UX Requirements — must be the best-in-class part of this app

This app's differentiator is polish. Apply these standards everywhere:

- **Layout**: A clean landing/tool hub (grid of conversion "cards" like iLovePDF — "PDF to Word", "Image to WebP", etc.) plus a universal "Convert Anything" mode where format is auto-detected after upload. Fully responsive: single-column stacked layout on mobile, multi-column grid on tablet/desktop, no horizontal scroll at any breakpoint.
- **Upload experience**: large, obvious drop zone with hover/drag-active states, file-type icons, per-file progress bars, ability to reorder/remove files before converting, and multi-file batch support with a "convert all" action.
- **Format picker**: smart, searchable dropdown that only shows valid target formats for the uploaded file(s); shows format icons and short descriptions; remembers last-used format.
- **Feedback states**: skeleton loaders, animated progress (upload %, convert %, ETA), success state with confetti-lite/checkmark animation, clear error states with retry buttons and human-readable error text (never raw stack traces).
- **Dark mode**: full light/dark theme with a toggle, respecting system preference by default, consistent contrast (WCAG AA minimum) in both.
- **Mobile-specific**: bottom-sheet style pickers instead of dropdowns on small screens, large tap targets (≥44px), native file-picker integration, works well on flaky mobile networks (resumable upload matters most here).
- **Accessibility**: full keyboard navigation, ARIA labels on upload/progress/buttons, focus states, screen-reader-announced progress updates.
- **Performance**: lazy-load non-critical routes, optimize images/icons (SVG icon set), Lighthouse performance score ≥90 on mobile.
- **Trust signals**: visible "your file is deleted immediately after you download it — nothing is stored" notice near the upload/download areas, file-size/type validation before upload starts, HTTPS-only, no ads/dark patterns.
- **Design language**: don't default to generic template look — pick a distinct type scale, an accent color with a real color system (50–900 shades), consistent 8px spacing grid, subtle shadows/elevation, and tasteful motion (150–250ms ease transitions). Avoid clichés like pure-purple-gradient-hero unless deliberately chosen.
- **Paywall modal**: a focused, non-dismissible-by-accident modal (dim background, centered card, works as a mobile bottom sheet) shown the moment *any* file over 350MB is selected, regardless of type. Clear headline, one sentence of explanation, prominent "Log in" and "Sign up" buttons, and a visible "choose a smaller file instead" escape hatch — never trap the user.

### 6. Security & Privacy

- Validate file type by magic bytes/content sniffing, not just extension.
- Virus/malware scan uploaded files (e.g., ClamAV in a worker step) before conversion.
- Enforce per-IP/user rate limiting and max concurrent jobs.
- Single-use, short-lived download links proxied through the backend (don't serve converted files from a permanently public path).
- Zero-retention by default: delete originals right after conversion, delete outputs right after download (or within the short safety-net window if never downloaded); make this visible in the UI, not just a backend cron job.
- Sanitize filenames; never execute uploaded content; run conversion CLIs with restricted permissions/timeouts to prevent zip-bomb/resource-exhaustion attacks.

### 7. Suggested Project Structure

```
/apps
  /web          → Next.js frontend
  /api          → Fastify/FastAPI backend (job creation, status, auth)
  /worker       → conversion workers (BullMQ/Celery consumers)
/packages
  /conversion-registry → shared format-mapping config + engine adapters
/infra
  docker-compose.yml
  Dockerfile.api
  Dockerfile.worker
  Dockerfile.web
```

### 8. Free Tier Limits & Subscription Gating (All File Types)

- **Free limit: 350MB per file, for every category** — documents, PDFs, spreadsheets, presentations, images, audio, video, archives, ebooks, fonts, all of it. There's no free-tier carve-out by type. Check this client-side immediately on file selection (before upload starts) so the user isn't stuck waiting, *and* re-validate server-side (never trust the client-side check alone).
- **On exceeding 350MB**: don't silently reject the file — show a clear modal/popup: *"Files over 350MB require a subscription. Sign up or log in to continue."* with two actions: **Log in** and **Sign up**, plus a secondary "choose a different file" option.
- **Auth flow**: use **Supabase Auth** with email-based sign-in — magic link or OTP, no password required for a smooth first-time flow. Signing up should be 1–2 fields max (email, then a code/link click).
- **After auth**: route the user to a subscription/upgrade screen (Stripe Checkout is the natural fit alongside Supabase). Only after an active subscription is confirmed should the >350MB upload be allowed to proceed — re-check subscription status server-side on the upload endpoint, not just client-side after login.
- **Already-subscribed users**: skip the modal entirely and allow uploads of any type up to the general max (Section 3's cap, e.g. 1–2GB).
- **Batch uploads**: apply the 350MB check per file, not to the combined batch size — a free user can still convert several small files at once.

### 9. Definition of Done

- I can drag in a 1GB+ video/document as a subscribed user and watch a real, resumable, non-blocking upload with live progress.
- I can convert at least one file from each category in the table above and get a correct output back.
- The UI is fully responsive and passes a manual check at 375px, 768px, and 1440px widths, in both light and dark mode.
- Errors (unsupported conversion, oversized file, engine failure) show clear, friendly messages — the app never silently hangs.
- Batch conversion of multiple files works and downloads as a zip.
- Files are provably deleted: convert a test file, download it, then check Supabase Storage directly and confirm both the original and the output are gone immediately. Separately, start a conversion, don't download it, wait past the safety-net window, and confirm it's been force-deleted too.
- Uploading *any* file type (document, image, video, PDF, archive, etc.) over 350MB as a logged-out user triggers the subscribe/login popup and blocks the upload; after logging in and subscribing, the same file uploads successfully.
- Run the app, open it in the built-in browser, and manually test the upload → convert → download flow before reporting completion.

## PROMPT END

---

## Phased Build Plan (optional — paste this instead if you'd rather ship incrementally)

If you want Antigravity to build this in stages rather than all at once, run the prompt above once per phase, adding: *"Build only Phase N below; assume later phases come later."*

1. **Phase 1 — MVP**: Single-file conversion for one category (e.g., images: JPG/PNG/WEBP/PDF via `sharp`), simple direct upload (no chunking yet, cap at 20MB), synchronous conversion, clean responsive UI.
2. **Phase 2 — Large files**: Add chunked/resumable upload, background job queue, real-time progress, object storage.
3. **Phase 3 — More formats**: Add documents (LibreOffice), audio/video (FFmpeg), archives, ebooks.
4. **Phase 4 — Polish & hardening**: Dark mode, accessibility pass, virus scanning, rate limiting, auto-delete cron, batch/zip download.

## Tips for using this in Antigravity

- Let the agent's **Planning Mode** generate a task list from this prompt before it starts coding — review the plan and adjust scope if it looks too large for one run.
- Use the **browser sub-agent's verification** step: explicitly ask it to actually upload a real test file and confirm the download works, not just that the build compiles.
- If a single run times out or scope feels too big, switch to the phased plan above.
