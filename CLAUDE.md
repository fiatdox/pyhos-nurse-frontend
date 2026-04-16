# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server on port 3001
npm run build    # Production build
npm run lint     # ESLint
```

No test suite is configured.

## Architecture

This is a **Next.js App Router** frontend for a hospital nurse management system (Thai language). It is a pure UI layer — there are no API routes in Next.js itself. All data comes from an external backend.

### API Proxy

All `/api/v1/*` requests are rewritten in `next.config.ts` to the backend:
```
NEXT_PUBLIC_API_URL=http://127.0.0.1:3000  (default: http://127.0.0.1:8080)
```

### Auth

JWT token stored in a cookie (`token=<jwt>`). Use the helpers in [app/lib/auth.ts](app/lib/auth.ts):
- `getToken()` — reads token from `document.cookie`
- `getAuthHeaders()` — returns `{ Authorization: 'Bearer <token>' }` or `{}`

All pages are `'use client'` components. Auth is checked client-side; expired/missing tokens redirect to `/`.

### Date Handling

- **`reg_datetime`** from the DB comes as **พ.ศ. (Buddhist Era)** — subtract 543 years before parsing with dayjs.
- Fields explicitly named `...Iso` or `regdate` are already **ค.ศ. (CE)** — parse directly.

### Route Structure

| Path | Purpose |
|------|---------|
| `/` | Login |
| `/main` | Dashboard (voice-to-text, Thai) |
| `/ipd/*` | In-patient: patients, register, discharge, daily-routine, shift-patient, ward-staffs, fte, order-food, reports |
| `/ic/*` | Intensive care: dashboard, follow-up, opd, ipd, lab/[id] |

### UI Stack

- **Ant Design 6** — primary component library. Do **not** import `antd/dist/reset.css` (v5+ handles CSS internally via ConfigProvider).
- **Tailwind CSS 4** — utility overrides. Ant Design class overrides use the `[&_.ant-table-thead_.ant-table-cell]:...!` pattern.
- **Font**: Sarabun (Thai), loaded via Google Fonts in root layout.
- **Theme color**: `#006b5f` (teal).

### Common Patterns

All pages follow this pattern:
```tsx
'use client';
// fetch token from cookie inline (or use getAuthHeaders from app/lib/auth.ts)
const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
const headers = token ? { Authorization: `Bearer ${token}` } : {};
await axios.get('/api/v1/...', { headers });
```

Notifications use Ant Design `App.useApp()` → `notification.success/error(...)`, wrapped with `<App>` at the page root.
