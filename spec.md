# Family Finances App — Spec

Personal finance tracker for two users (husband + wife). Private, web-based PWA.
Not a Bykreator project — personal use only.

---

## What it is

A shared finance tracker for a couple running two businesses plus a household.
Manual logging only — no bank sync. AI-assisted monthly targets. Push notifications for due expenses.

---

## Users

- 2 users only: **Mića** (husband) and **Olgica** (wife)
- Shared everything — one combined view, no separate wallets
- Auth: Supabase (2 accounts, invite-only, no public signup)

---

## Buckets (top-level grouping)

1. **Kuća** — household expenses and income
2. **Bykreator Studio** — Mića's income and business expenses
3. **October Care** — Olgica's income and business expenses
4. **Sve** — everything combined (always visible as a summary)

---

## Categories

- Fully custom per bucket (taxes, salaries, utilities, equipment, food, etc.)
- User can add, edit, rename, delete categories
- Each category assigned to a bucket
- Category has a type: expense or income

---

## Transaction Types

### Fixed
- Same amount every month (rent, subscriptions, salaries)
- Created once, auto-populates each month
- Has a due date (day of month)

### Variable Recurring
- Same category every month, amount changes (electricity, fuel)
- Auto-created as placeholder each month, user fills actual amount
- AI learns expected range from history

### Ad-hoc
- One-time manual entry
- Any bucket, any category

---

## Dugovi Tab (Debts)

Separate tab for personal debts — not bank loans (those are fixed expenses).

### Two directions:
- **We owe** — money owed to people/businesses
- **They owe us** — money we lent out

### Per debt entry:
- Name (who)
- Which bucket (Kuća / Bykreator Studio / October Care)
- Total amount + currency
- Start date
- Notes
- Payment log — each payment/receipt logged, balance reduces
- Status: active / settled

### Tab overview:
- Total we owe (all active debts combined)
- Total owed to us
- Net position (owed to us minus we owe)
- Per-debt cards with remaining balance and last activity

---

## Checks Tab (Čekovi)

Separate tab for post-dated checks.

- Always RSD, always 5,000 RSD each
- Entry = date + quantity (e.g. 3 checks on May 20 = 15,000 RSD)
- Status: pending / cleared / missed
- Expense only (food etc.)
- When cleared → flows into that month's expense automatically
- Monthly total of outstanding checks visible

---

## Income Tracking

- Log income entries: who earned it (him / her), which bucket, how much, currency
- Dashboard shows:
  - His total income (current month + history)
  - Her total income (current month + history)
  - Combined total
  - Per bucket breakdown

---

## Currency

- **RSD** (primary) and **EUR**
- Exchange rate: NBS middle rate (srednji kurs NBS) — public XML feed, no API key needed
- Rate fetched daily, cached
- All amounts can be viewed as RSD, EUR, or mixed with conversion
- Combined totals shown in both currencies

---

## Savings

- Manual log — user records when they physically move money to savings
- Each entry: date, amount, currency, optional note
- Running total visible
- Optional savings goal with progress indicator
- Separate from expenses — purely a log

---

## Notifications (Critical Feature)

Push notifications via PWA (Web Push + VAPID + Service Worker).

**iOS requirement:** user must "Add to Home Screen" in Safari. Onboarding has a mandatory install step with instructions.

### Notification schedule per recurring item:
- 1 week before due date
- 3 days before due date
- On the due date

### Dashboard indicators:
- "X recurring items unlogged this month" — visible on home screen

### Server-side:
- Daily cron job (Vercel cron) checks what's due and sends pushes

---

## AI Features (practical, not gimmicky)

- **"What do we need to earn this month"** — calculated from:
  - All fixed expenses (known)
  - Estimated variable expenses (learned from history)
  - Deficit/surplus carried from last month
  - Savings goal for the month
- **Variable expense estimates** — after 3-4 months of data, pre-fills expected amounts
- **Monthly briefing** — "June needs X RSD to break even. Logged Y so far. Gap: Z."
- **Unusual spend alert** — flags when a month is tracking higher than usual
- AI model: Claude API (claude-sonnet-4-6 or newer)

---

## Month Close Flow

At end of each month:
1. Review all variable expenses — confirm or correct amounts
2. Log actual income if not already done
3. System calculates surplus or deficit
4. Rolls result into next month's target
5. Month is locked (read-only after close)

---

## Dashboard

- Current month overview: earned vs. spent vs. target
- "Need to earn" number (updated in real time as you log)
- Per-bucket breakdown
- Unlogged items alert
- Savings progress
- Checks outstanding this month
- Quick add button (fast logging — under 10 seconds)

---

## Logging UX (Priority)

Fast entry is critical — if it's slow, the app fails.
- Tap "+" → pick bucket → pick category → enter amount → done
- Pre-fills currency based on category default
- Recurring items: just confirm amount, everything else pre-filled

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Database + Auth | Supabase |
| Deployment | Vercel |
| Push notifications | Web Push (VAPID) + Service Worker |
| Cron jobs | Vercel Cron |
| AI | Claude API |
| Exchange rate | NBS XML feed |
| Styling | TBD |

---

## Design

- Light theme, clean and minimal
- Inspired by Fresha — lots of white space, clear cards, subtle borders, rounded corners
- Primary color: green (not purple)
- Font: Inter or similar clean sans-serif
- Tailwind CSS

---

## What it does NOT do

- No bank sync
- No export (everything visible in app)
- No tax automation (tax is just a fixed monthly expense category)
- No investment tracking
- No public signup

---

## Status

**Planning stage.** Waiting for full list of categories and fixed expenses from user.
Next step: structure categories, then start build.
