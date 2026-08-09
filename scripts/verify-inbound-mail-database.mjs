import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const migrationsDirectory = join(repositoryRoot, "supabase", "migrations");
const db = new PGlite({ extensions: { pgcrypto } });

const APPLICATION_ID = "20000000-0000-4000-8000-000000000091";
const STAFF_ID = "10000000-0000-4000-8000-000000000091";

async function expectDatabaseError(operation, expectedMessage) {
  await assert.rejects(operation, (error) => {
    assert.match(String(error?.message), expectedMessage);
    return true;
  });
}

async function applyMigrations() {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create function auth.uid()
    returns uuid
    language sql
    stable
    as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    create schema storage;
    create table storage.buckets (
      id text primary key,
      name text not null,
      public boolean not null default false,
      file_size_limit bigint,
      allowed_mime_types text[]
    );
  `);

  const migrationNames = (await readdir(migrationsDirectory))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  for (const migrationName of migrationNames) {
    const migration = await readFile(join(migrationsDirectory, migrationName), "utf8");
    await db.exec(migration);
  }
}

async function createApplication() {
  const result = await db.query(
    `
      insert into public.applications (
        id,
        first_name,
        last_name,
        street_address,
        city,
        state,
        postal_code,
        phone,
        email,
        rental_start_date,
        rental_end_date,
        pickup_time,
        dropoff_time,
        rental_weeks,
        intended_vehicle_use,
        payment_method,
        drivers_license_path,
        proof_of_address_path,
        sms_consent
      )
      values (
        $1::uuid,
        'Morgan',
        'Reply',
        '100 Test Street',
        'Calgary',
        'AB',
        'T1X 1X1',
        '+14035550191',
        'morgan@example.com',
        '2099-01-01',
        '2099-01-15',
        '09:00',
        '17:00',
        999,
        'personal_use',
        'card',
        $1::text || '/drivers-license.pdf',
        $1::text || '/proof-of-address.png',
        true
      )
      returning application_number, status
    `,
    [APPLICATION_ID],
  );

  await db.query(
    "update public.applications set status = 'more_information_required' where id = $1",
    [APPLICATION_ID],
  );

  return result.rows[0].application_number;
}

async function storeInboundMessage(applicationNumber, externalMessageId, zohoMessageId) {
  const result = await db.query(
    `
      select *
      from public.store_inbound_application_message(
        $1::text,
        'customer@example.com'::text,
        'applications@dlride.com'::text,
        $2::text,
        'Here is the requested information.'::text,
        $3::text,
        '2099-01-02T12:34:56Z'::timestamptz,
        '<p>Here is the requested information.</p>'::text,
        $4::text,
        'zoho-thread-1'::text,
        '<outbound-message@example.com>'::text,
        true
      )
    `,
    [
      applicationNumber,
      `Re: More information needed — ${applicationNumber ?? "no reference"}`,
      externalMessageId,
      zohoMessageId,
    ],
  );

  return result.rows[0];
}

try {
  await applyMigrations();

  const bucket = await db.query(
    `
      select public, file_size_limit, allowed_mime_types
      from storage.buckets
      where id = 'application-email-attachments'
    `,
  );
  assert.deepEqual(bucket.rows, [{
    public: false,
    file_size_limit: 10_485_760,
    allowed_mime_types: ["application/pdf", "image/jpeg", "image/png"],
  }]);

  await db.exec("set role anon");
  await expectDatabaseError(
    () => db.query("select id from public.application_messages"),
    /permission denied/i,
  );
  await expectDatabaseError(
    () => db.query("select id from public.message_attachments"),
    /permission denied/i,
  );
  await db.exec("reset role");

  await db.exec(`set request.jwt.claim.sub = '${STAFF_ID}'`);
  await db.exec("set role authenticated");
  assert.deepEqual(
    (await db.query("select id from public.application_messages")).rows,
    [],
  );
  await expectDatabaseError(
    () => db.query(
      `
        select *
        from public.store_inbound_application_message(
          null, 'customer@example.com', 'applications@dlride.com', 'subject',
          'body', '<unauthorized@example.com>', now()
        )
      `,
    ),
    /permission denied/i,
  );
  await db.exec("reset role");

  const applicationNumber = await createApplication();
  assert.match(applicationNumber, /^DLR-\d{6}$/);

  await db.exec("set role service_role");
  const matched = await storeInboundMessage(
    applicationNumber,
    "<customer-reply@example.com>",
    "zoho-message-1",
  );
  assert.equal(matched.application_id, APPLICATION_ID);
  assert.equal(matched.message_status, "matched");
  assert.equal(matched.inserted, true);

  const unreadInbound = await db.query(
    "select is_read, read_at from public.application_messages where id = $1",
    [matched.message_id],
  );
  assert.deepEqual(unreadInbound.rows, [{ is_read: false, read_at: null }]);

  const duplicate = await storeInboundMessage(
    applicationNumber,
    "<customer-reply@example.com>",
    "zoho-message-1",
  );
  assert.equal(duplicate.message_id, matched.message_id);
  assert.equal(duplicate.inserted, false);

  const sameZohoMessage = await storeInboundMessage(
    applicationNumber,
    "<different-rfc-id@example.com>",
    "zoho-message-1",
  );
  assert.equal(sameZohoMessage.message_id, matched.message_id);
  assert.equal(sameZohoMessage.inserted, false);

  const unmatched = await storeInboundMessage(
    null,
    "<unmatched@example.com>",
    "zoho-message-2",
  );
  assert.equal(unmatched.application_id, null);
  assert.equal(unmatched.message_status, "unmatched");
  assert.equal(unmatched.inserted, true);

  await expectDatabaseError(
    () => db.query(
      `
        insert into public.application_messages (
          direction, sender_email, recipient_email, subject, body_text,
          external_message_id, status, received_at
        ) values (
          'inbound', 'bypass@example.com', 'applications@dlride.com', 'Bypass',
          '', '<bypass@example.com>', 'unmatched', now()
        )
      `,
    ),
    /permission denied/i,
  );
  await expectDatabaseError(
    () => db.query(
      "update public.application_messages set subject = 'tampered' where id = $1",
      [matched.message_id],
    ),
    /permission denied/i,
  );
  const failedAttachmentUpdate = await db.query(
    `
      update public.application_messages
      set status = 'failed'
      where id = $1
      returning status
    `,
    [matched.message_id],
  );
  assert.deepEqual(failedAttachmentUpdate.rows, [{ status: "failed" }]);
  await db.query(
    "update public.application_messages set status = 'matched' where id = $1",
    [matched.message_id],
  );
  await db.exec("reset role");

  await db.exec(`set request.jwt.claim.sub = '${STAFF_ID}'`);
  await db.exec("set role authenticated");
  const unreadCounts = await db.query(
    "select * from public.get_application_unread_reply_counts(array[$1::uuid])",
    [APPLICATION_ID],
  );
  assert.deepEqual(unreadCounts.rows, [{ application_id: APPLICATION_ID, unread_count: 1 }]);
  await expectDatabaseError(
    () => db.query(
      "update public.application_messages set is_read = true where id = $1",
      [matched.message_id],
    ),
    /permission denied/i,
  );
  await db.exec("reset role");

  await db.exec("set role service_role");
  const markedRead = await db.query(
    `
      update public.application_messages
      set is_read = true
      where id = $1
      returning is_read, read_at
    `,
    [matched.message_id],
  );
  assert.equal(markedRead.rows[0].is_read, true);
  assert.ok(markedRead.rows[0].read_at instanceof Date);

  await db.query(
    `
      select *
      from public.store_outbound_application_message(
        $1::uuid,
        'applications@dlride.com'::text,
        'customer@example.com'::text,
        'Staff reply'::text,
        'Thanks for the update.'::text,
        '<staff-reply@example.com>'::text,
        '2099-01-02T13:00:00Z'::timestamptz
      )
    `,
    [APPLICATION_ID],
  );
  const outboundReadState = await db.query(
    `
      select is_read, read_at
      from public.application_messages
      where external_message_id = '<staff-reply@example.com>'
    `,
  );
  assert.equal(outboundReadState.rows[0].is_read, true);
  assert.ok(outboundReadState.rows[0].read_at instanceof Date);
  await db.exec("reset role");

  await db.exec(`set request.jwt.claim.sub = '${STAFF_ID}'`);
  await db.exec("set role authenticated");
  const countsAfterRead = await db.query(
    "select * from public.get_application_unread_reply_counts(array[$1::uuid])",
    [APPLICATION_ID],
  );
  assert.deepEqual(countsAfterRead.rows, []);
  await db.exec("reset role");

  const messages = await db.query(
    `
      select application_id, application_number, direction, status, body_html
      from public.application_messages
      order by external_message_id
    `,
  );
  assert.equal(messages.rows.length, 3);
  assert.deepEqual(
    messages.rows.map(({ application_id, application_number, direction, status }) => ({
      application_id,
      application_number,
      direction,
      status,
    })),
    [
      {
        application_id: APPLICATION_ID,
        application_number: applicationNumber,
        direction: "inbound",
        status: "matched",
      },
      {
        application_id: APPLICATION_ID,
        application_number: applicationNumber,
        direction: "outbound",
        status: "matched",
      },
      {
        application_id: null,
        application_number: null,
        direction: "inbound",
        status: "unmatched",
      },
    ],
  );
  assert.equal(messages.rows[0].body_html, "<p>Here is the requested information.</p>");

  const application = await db.query(
    "select status from public.applications where id = $1",
    [APPLICATION_ID],
  );
  assert.equal(application.rows[0].status, "more_information_required");

  const customerReplyHistory = await db.query(
    `
      select
        activity.action,
        activity.note,
        activity.previous_status,
        activity.new_status,
        activity.created_at
      from public.application_activity as activity
      where activity.application_id = $1
        and activity.action = 'customer_replied'
    `,
    [APPLICATION_ID],
  );
  assert.equal(customerReplyHistory.rows.length, 1);
  assert.equal(
    customerReplyHistory.rows[0].note,
    `Message reference: ${matched.message_id}`,
  );
  assert.equal(customerReplyHistory.rows[0].previous_status, "more_information_required");
  assert.equal(customerReplyHistory.rows[0].new_status, "more_information_required");
  assert.equal(
    customerReplyHistory.rows[0].created_at.toISOString(),
    "2099-01-02T12:34:56.000Z",
  );
  assert.equal(customerReplyHistory.rows[0].note.includes("requested information"), false);

  await db.query(
    `
      insert into public.message_attachments (
        message_id,
        filename,
        mime_type,
        file_size,
        storage_path
      ) values ($1, 'identity.pdf', 'application/pdf', 10485760, $2)
    `,
    [
      matched.message_id,
      `${APPLICATION_ID}/${matched.message_id}/identity.pdf`,
    ],
  );

  await expectDatabaseError(
    () => db.query(
      `
        insert into public.message_attachments (
          message_id, filename, mime_type, file_size, storage_path
        ) values ($1, 'script.svg', 'image/svg+xml', 100, $2)
      `,
      [matched.message_id, `${APPLICATION_ID}/${matched.message_id}/script.svg`],
    ),
    /message_attachments_mime_type_check/i,
  );
  await expectDatabaseError(
    () => db.query(
      `
        insert into public.message_attachments (
          message_id, filename, mime_type, file_size, storage_path
        ) values ($1, 'large.pdf', 'application/pdf', 10485761, $2)
      `,
      [matched.message_id, `${APPLICATION_ID}/${matched.message_id}/large.pdf`],
    ),
    /message_attachments_file_size_check/i,
  );
  await expectDatabaseError(
    () => db.query(
      `
        insert into public.message_attachments (
          message_id, filename, mime_type, file_size, storage_path
        ) values ($1, 'public.pdf', 'application/pdf', 100, $2)
      `,
      [matched.message_id, "https://public.example.com/public.pdf"],
    ),
    /message_attachments_storage_path_check/i,
  );

  console.log("Inbound mail database verification passed.");
} finally {
  await db.close();
}
