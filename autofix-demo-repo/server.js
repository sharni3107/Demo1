require("dotenv").config();
const express = require("express");
const { reportError } = require("./autofixReporter");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4000;

// --- fake "database" -------------------------------------------------
// Note: user id 3 has NO `orders` field on purpose. That's the bug.
const users = [
  { id: 1, name: "Ada Lovelace", orders: [{ amount: 42.5 }, { amount: 10 }] },
  { id: 2, name: "Grace Hopper", orders: [{ amount: 100 }] },
  { id: 3, name: "Guest User" }, // <-- missing `orders`, nothing sets a default
];

// --- routes ------------------------------------------------------------

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/users", (_req, res) => {
  res.json(users.map(({ id, name }) => ({ id, name })));
});

// THE BUG: for a user with no `orders` array (e.g. id=3), `user.orders`
// is undefined, so `.reduce(...)` throws a TypeError. There's no null
// check / default here. Hitting /api/users/3/total (or any id without
// orders) reliably crashes this route.
app.get("/api/users/:id/total", (req, res) => {
  const id = Number(req.params.id);
  const user = users.find((u) => u.id === id);

  if (!user) {
    return res.status(404).json({ error: `User ${id} not found` });
  }

  const total = user.orders.reduce((sum, order) => sum + order.amount, 0);

  res.json({ id: user.id, name: user.name, total });
});

// --- AutoFix AI reporting -------------------------------------------
// Express 4 forwards synchronous throws from routes into this handler
// automatically. This is the one place every unhandled error in the app
// flows through, so it's the natural spot to report to AutoFix AI.
app.use((err, req, res, _next) => {
  console.error(err);

  reportError({
    error: err,
    endpoint: `${req.method} ${req.originalUrl}`,
    level: "error",
    metadata: {
      params: req.params,
      query: req.query,
    },
  });

  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`autofix-demo-buggy-shop listening on http://127.0.0.1:${PORT}`);
  console.log(`Try:  curl http://127.0.0.1:${PORT}/api/users/3/total   <- triggers the bug`);
  console.log(`vs:   curl http://127.0.0.1:${PORT}/api/users/1/total   <- works fine`);
});
