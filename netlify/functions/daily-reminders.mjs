// Netlify scheduled function: triggers the daily reminder run at 09:00 IST (03:30 UTC).
// The work itself happens in the app at /api/cron/reminders, which is idempotent per day.
async function dailyReminders() {
  const base = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    console.error("daily-reminders: URL or CRON_SECRET is not set");
    return;
  }
  const response = await fetch(`${base}/api/cron/reminders`, { method: "POST", headers: { authorization: `Bearer ${secret}` } });
  console.log("daily-reminders", response.status, await response.text());
}

export default dailyReminders;

export const config = { schedule: "30 3 * * *" };
