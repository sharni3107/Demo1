# autofix-demo-buggy-shop

A tiny Express app with exactly one intentional bug, wired to report its
errors to an AutoFix AI backend. Use this to test the full ingestion ->
incident pipeline end to end with a real crash instead of the "Send Test
Log" button.

## The bug

`GET /api/users/:id/total` sums up a user's orders. User `id=3` ("Guest
User") has no `orders` field in the fake in-memory data, and the route
never checks for that — so `user.orders.reduce(...)` throws:

```
TypeError: Cannot read properties of undefined (reading 'reduce')
```

Every other user id (1, 2) works fine, so you can compare a working
request against a broken one.

## Setup

1. In AutoFix AI: create (or reuse) a Project -> Environment -> Application,
   and grab that application's ingestion key (shown once when you create
   the key, or via "Rotate Key" if you need a new one).

2. In this repo:

   ```bash
   cp .env.example .env
   ```

   Then fill in `.env`:

   ```
   AUTOFIX_API_URL=http://127.0.0.1:8000     # wherever your AutoFix backend runs
   AUTOFIX_INGESTION_KEY=afx_live_...        # the key from step 1
   ```

3. Install and run:

   ```bash
   npm install
   npm start
   ```

   You should see it come up on `http://127.0.0.1:4000`.

## Triggering it

With the AutoFix backend running and this app running:

```bash
# works fine
curl http://127.0.0.1:4000/api/users/1/total

# crashes -> reported to AutoFix AI
curl http://127.0.0.1:4000/api/users/3/total
```

The second call returns a 500 from this app, and — assuming
`AUTOFIX_API_URL` / `AUTOFIX_INGESTION_KEY` are correct — you should see
a new log (and likely a new incident, since it's level `error` with a
stack trace) show up under that Application's Project in the AutoFix AI
Logs tab and Incidents tab.

If nothing shows up, check this app's terminal output first — the
reporter (`autofixReporter.js`) logs whether the POST to
`/api/logs` succeeded, failed with a non-2xx status, or couldn't reach
the backend at all, which tells you which side of the pipeline to look
at next.

## Fixing it (optional)

The actual fix is trivial, once AutoFix AI's pipeline investigates it:

```js
const total = (user.orders || []).reduce((sum, order) => sum + order.amount, 0);
```
