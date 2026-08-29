/**
 * Minimal AutoFix AI log reporter.
 *
 * Real integrations would usually hook this into a global error handler /
 * process.on("uncaughtException") etc. For this demo we just call
 * reportError() by hand from the one route that has the bug, and from the
 * Express error-handling middleware as a catch-all.
 *
 * Mirrors POST /api/logs on the AutoFix AI backend:
 *   headers: { "X-API-Key": <ingestion key> }
 *   body: { level, message, stack_trace, endpoint, metadata }
 */

const AUTOFIX_API_URL = process.env.AUTOFIX_API_URL || "http://127.0.0.1:8000";
const AUTOFIX_INGESTION_KEY = process.env.AUTOFIX_INGESTION_KEY || "";

async function reportError({ error, endpoint, level = "error", metadata = {} }) {
  if (!AUTOFIX_INGESTION_KEY) {
    console.warn(
      "[autofix] AUTOFIX_INGESTION_KEY is not set — skipping log report. " +
        "Set it in .env to send errors to AutoFix AI."
    );
    return;
  }

  const payload = {
    level,
    message: error?.message || String(error),
    stack_trace: error?.stack || "",
    endpoint: endpoint || "",
    metadata,
  };

  try {
    const res = await fetch(`${AUTOFIX_API_URL}/api/logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": AUTOFIX_INGESTION_KEY,
      },
      body: JSON.stringify(payload),
    });

    const body = await res.json().catch(() => null);

    if (!res.ok) {
      console.error(`[autofix] log ingest failed (${res.status}):`, body);
      return;
    }

    console.log(
      `[autofix] log reported -> ${body?.log_id ?? "?"}` +
        (body?.incident_created ? ` (created incident ${body.incident_id})` : "")
    );
  } catch (networkErr) {
    // Never let reporting failures break the app itself.
    console.error(
      `[autofix] could not reach AutoFix AI at ${AUTOFIX_API_URL}:`,
      networkErr.message
    );
  }
}

module.exports = { reportError };
