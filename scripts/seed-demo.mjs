// Seeds a demo firm for client demos. Idempotent: does nothing if the demo user already exists.
import { randomBytes, scrypt } from "node:crypto";
import pg from "pg";

const EMAIL = "demo@docchase.test";
const PASSWORD = "demo-password-123";
const N = 2 ** 15;

const hash = () =>
  new Promise((resolve, reject) => {
    const salt = randomBytes(16);
    scrypt(PASSWORD, salt, 64, { N, r: 8, p: 1, maxmem: 128 * N * 8 * 2 }, (e, key) =>
      e ? reject(e) : resolve(`scrypt$${N}$${salt.toString("base64url")}$${key.toString("base64url")}`),
    );
  });

const ist = new Date(Date.now() + 5.5 * 3600_000);
const y = ist.getUTCFullYear();
const m = ist.getUTCMonth();
const ymd = (year, month0, day) => new Date(Date.UTC(year, month0, day)).toISOString().slice(0, 10);
// Last month's documents are collected this month (request on the 1st; due on the 28th so a demo is never "overdue" mid-month).
const month = ymd(y, m - 1, 1);
const requestDate = ymd(y, m, 1);
const dueDate = ymd(y, m, 28);

const clients = [
  ["Sharma Traders", "+919820012345", "sharma@example.com", "27ABCDE1234F1Z5", "whatsapp", "all"],
  ["Mehta & Sons Pvt Ltd", "+919820012346", "mehta@example.com", "27ABCDE5678G1Z2", "whatsapp", "most"],
  ["Patel Textiles", "+919820012347", "patel@example.com", "24ABCDE9012H1Z8", "whatsapp", "some"],
  ["Iyer Consultancy LLP", null, "iyer@example.com", "33ABCDE3456J1Z4", "email", "all"],
  ["Khan Logistics", "+919820012349", "khan@example.com", "27ABCDE7890K1Z1", "whatsapp", "none"],
  ["Desai Pharma Distributors", "+919820012350", "desai@example.com", "24ABCDE2345L1Z6", "whatsapp", "some"],
  ["Nair Spices Exports", "+919820012351", "nair@example.com", "32ABCDE6789M1Z3", "whatsapp", "none"],
  ["Gupta Hardware", "+919820012352", "gupta@example.com", "07ABCDE0123N1Z9", "whatsapp", "most"],
];
const docTypes = ["GSTR-1 sales register", "Purchase invoices", "Bank statement", "TDS challans"];

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const existing = await client.query("select 1 from users where email = $1", [EMAIL]);
  if (existing.rowCount) {
    console.log("demo data already present");
  } else {
    await client.query("begin");
    const firm = (
      await client.query(
        "insert into firms (name, request_day, due_day) values ('Demo & Associates, Chartered Accountants', 1, 28) returning id",
      )
    ).rows[0].id;
    const user = (
      await client.query("insert into users (email, name, password_hash) values ($1, 'Demo CA', $2) returning id", [
        EMAIL,
        await hash(),
      ])
    ).rows[0].id;
    await client.query("insert into firm_members (firm_id, user_id, role) values ($1, $2, 'owner')", [firm, user]);

    const typeIds = [];
    for (const [i, name] of docTypes.entries()) {
      typeIds.push(
        (
          await client.query("insert into document_types (firm_id, name, sort_order) values ($1, $2, $3) returning id", [
            firm,
            name,
            i,
          ])
        ).rows[0].id,
      );
    }
    const period = (
      await client.query(
        "insert into periods (firm_id, month, request_date, due_date) values ($1, $2, $3, $4) returning id",
        [firm, month, requestDate, dueDate],
      )
    ).rows[0].id;

    for (const [ci, [name, phone, email, gstin, channel, progress]] of clients.entries()) {
      const id = (
        await client.query(
          `insert into clients (firm_id, name, phone, email, gstin, channel, whatsapp_opt_in)
           values ($1, $2, $3, $4, $5, $6, $7) returning id`,
          [firm, name, phone, email, gstin, channel, channel === "whatsapp"],
        )
      ).rows[0].id;
      await client.query(
        "insert into upload_links (firm_id, client_id, period_id, expires_at) values ($1, $2, $3, $4::date + 46)",
        [firm, id, period, dueDate],
      );
      const received = { all: 4, most: 3, some: 1, none: 0 }[progress];
      for (const [ti, typeId] of typeIds.entries()) {
        await client.query(
          "insert into client_requirements (firm_id, client_id, document_type_id) values ($1, $2, $3)",
          [firm, id, typeId],
        );
        const done = ti < received;
        await client.query(
          `insert into document_requests (firm_id, client_id, period_id, document_type_id, status, received_at)
           values ($1, $2, $3, $4, $5, $6)`,
          [firm, id, period, typeId, done ? "received" : "pending", done ? new Date(Date.now() - (ci + 1) * 5 * 3600_000) : null],
        );
      }
    }
    await client.query("commit");
    console.log(`seeded demo firm (login: ${EMAIL} / ${PASSWORD})`);
  }
} catch (error) {
  await client.query("rollback").catch(() => {});
  throw error;
} finally {
  await client.end();
}
