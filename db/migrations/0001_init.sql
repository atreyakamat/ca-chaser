-- Core schema. Every tenant table carries firm_id and is protected by row-level security.
-- The app runs tenant queries as the unprivileged role "app_user" with app.firm_id set per
-- transaction, so a missing WHERE clause cannot leak another firm's data.

do $$
begin
  if not exists (select from pg_roles where rolname = 'app_user') then
    create role app_user nologin;
  end if;
end
$$;

do $$
begin
  execute format('grant app_user to %I', current_user);
exception when others then
  -- Superusers and existing members can already SET ROLE.
  null;
end
$$;

create function app_firm_id() returns uuid
  language sql stable
  as $$ select nullif(current_setting('app.firm_id', true), '')::uuid $$;

create table firms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  timezone text not null default 'Asia/Kolkata',
  -- Documents for month M are requested on request_day and due on due_day of month M+1.
  request_day int not null default 1 check (request_day between 1 and 28),
  due_day int not null default 10 check (due_day between 1 and 28),
  reminder_offsets int[] not null default '{7,3,1}',
  created_at timestamptz not null default now(),
  check (due_day > request_day)
);

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email)),
  name text not null check (length(trim(name)) between 1 and 120),
  password_hash text not null,
  created_at timestamptz not null default now(),
  unique (email)
);

create table firm_members (
  firm_id uuid not null references firms (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (firm_id, user_id)
);

create table auth_attempts (
  id bigint generated always as identity primary key,
  email text not null,
  succeeded boolean not null,
  created_at timestamptz not null default now()
);
create index auth_attempts_email_idx on auth_attempts (email, created_at desc);

create table clients (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  phone text check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  email text check (email = lower(email)),
  gstin text check (gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  channel text not null default 'whatsapp' check (channel in ('whatsapp', 'email')),
  whatsapp_opt_in boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, firm_id),
  check (phone is not null or email is not null)
);
create index clients_firm_idx on clients (firm_id, name);

create table document_types (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, firm_id),
  unique (firm_id, name)
);

create table client_requirements (
  firm_id uuid not null,
  client_id uuid not null,
  document_type_id uuid not null,
  primary key (client_id, document_type_id),
  foreign key (client_id, firm_id) references clients (id, firm_id) on delete cascade,
  foreign key (document_type_id, firm_id) references document_types (id, firm_id) on delete cascade
);

create table periods (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  request_date date not null,
  due_date date not null,
  created_at timestamptz not null default now(),
  unique (id, firm_id),
  unique (firm_id, month),
  check (due_date >= request_date)
);

create table document_requests (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null,
  client_id uuid not null,
  period_id uuid not null,
  document_type_id uuid not null,
  status text not null default 'pending' check (status in ('pending', 'received')),
  received_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, firm_id),
  unique (client_id, period_id, document_type_id),
  foreign key (client_id, firm_id) references clients (id, firm_id) on delete cascade,
  foreign key (period_id, firm_id) references periods (id, firm_id) on delete cascade,
  foreign key (document_type_id, firm_id) references document_types (id, firm_id) on delete cascade,
  check ((status = 'received') = (received_at is not null))
);
create index document_requests_period_idx on document_requests (period_id, client_id);

create table uploads (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null,
  request_id uuid not null,
  storage_key text not null unique,
  file_name text not null,
  content_type text not null,
  size_bytes int not null check (size_bytes > 0),
  uploaded_by text not null default 'client' check (uploaded_by in ('client', 'firm')),
  created_at timestamptz not null default now(),
  foreign key (request_id, firm_id) references document_requests (id, firm_id) on delete cascade
);
create index uploads_request_idx on uploads (request_id);

-- One upload link per client and period. The link token is the row id signed with a server
-- secret (see src/server/links.ts), so nothing in this table can be used to forge a link.
create table upload_links (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null,
  client_id uuid not null,
  period_id uuid not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (client_id, period_id),
  foreign key (client_id, firm_id) references clients (id, firm_id) on delete cascade,
  foreign key (period_id, firm_id) references periods (id, firm_id) on delete cascade
);

create table reminder_log (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null,
  client_id uuid not null,
  period_id uuid not null,
  kind text not null check (kind in ('request', 'followup', 'overdue', 'nudge')),
  channel text not null check (channel in ('whatsapp', 'email')),
  status text not null check (status in ('sent', 'mock', 'failed', 'skipped')),
  detail text,
  body text not null,
  -- Set for scheduled sends so a repeated cron run cannot message a client twice in a day.
  dedupe_key text unique,
  created_at timestamptz not null default now(),
  foreign key (client_id, firm_id) references clients (id, firm_id) on delete cascade,
  foreign key (period_id, firm_id) references periods (id, firm_id) on delete cascade
);
create index reminder_log_firm_idx on reminder_log (firm_id, created_at desc);

-- Row-level security -------------------------------------------------------------------

grant usage on schema public to app_user;
grant select, update on firms to app_user;
grant select on firm_members to app_user;
grant select, insert, update, delete on
  clients, document_types, client_requirements, periods, document_requests, uploads, upload_links, reminder_log
  to app_user;

alter table firms enable row level security;
alter table users enable row level security;
alter table firm_members enable row level security;
alter table auth_attempts enable row level security;
alter table clients enable row level security;
alter table document_types enable row level security;
alter table client_requirements enable row level security;
alter table periods enable row level security;
alter table document_requests enable row level security;
alter table uploads enable row level security;
alter table upload_links enable row level security;
alter table reminder_log enable row level security;

create policy tenant on firms for all to app_user using (id = app_firm_id()) with check (id = app_firm_id());

do $$
declare t text;
begin
  foreach t in array array['firm_members', 'clients', 'document_types', 'client_requirements', 'periods',
                           'document_requests', 'uploads', 'upload_links', 'reminder_log']
  loop
    execute format(
      'create policy tenant on %I for all to app_user using (firm_id = app_firm_id()) with check (firm_id = app_firm_id())', t);
  end loop;
end
$$;
-- users and auth_attempts have no policies: only the owner role (sign-in code) can read them.
