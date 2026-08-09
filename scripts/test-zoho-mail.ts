import {
  isZohoSendAliasAuthorized,
  listRecentZohoMessages,
  readZohoMessage,
  replyToZohoMessage,
  sendZohoMessage,
  verifyZohoMailboxIdentity,
  ZohoAccessTokenManager,
  ZohoMailClient,
} from "../lib/zoho-mail/index.ts";

function environment(name: string) {
  return Deno.env.get(name)?.trim() ?? "";
}

function required(name: string) {
  const configured = environment(name);
  if (!configured) throw new Error(`${name} is required`);
  return configured;
}

const configuration = {
  clientId: required("ZOHO_CLIENT_ID"),
  clientSecret: required("ZOHO_CLIENT_SECRET"),
  refreshToken: required("ZOHO_REFRESH_TOKEN"),
  accountId: required("ZOHO_MAIL_ACCOUNT_ID"),
  mailAddress: required("ZOHO_MAIL_ADDRESS").toLowerCase(),
  fromAlias: required("ZOHO_MAIL_FROM_ALIAS").toLowerCase(),
  accountsBaseUrl: required("ZOHO_ACCOUNTS_BASE_URL"),
  mailApiBaseUrl: required("ZOHO_MAIL_API_BASE_URL"),
};

const manager = new ZohoAccessTokenManager(configuration);
await manager.getAccessToken(true);
console.log("Access token refresh: passed");

const client = new ZohoMailClient(
  configuration.mailApiBaseUrl,
  (force) => manager.getAccessToken(force),
);
const account = await verifyZohoMailboxIdentity(
  client,
  configuration.accountId,
  configuration.mailAddress,
);
console.log(`Mailbox identity: passed (${configuration.mailAddress})`);

if (!isZohoSendAliasAuthorized(account, configuration.fromAlias)) {
  throw new Error(`${configuration.fromAlias} is not authorized as a Zoho Send Mail As address`);
}
console.log(`Send Mail As alias: passed (${configuration.fromAlias})`);

const messages = await listRecentZohoMessages(client, configuration.accountId, 5);
console.log(`List messages: passed (${messages.length} returned)`);
if (!messages[0]) throw new Error("A test message is required to run the read test");
const content = await readZohoMessage(client, configuration.accountId, messages[0]);
if (typeof content.content !== "string") throw new Error("Zoho message content was not readable");
console.log("Read message: passed");

const testRecipient = required("ZOHO_TEST_RECIPIENT_EMAIL");
const testSubject = `DLride Ops Zoho connection test ${crypto.randomUUID()}`;
await sendZohoMessage(client, configuration.accountId, {
  fromAddress: configuration.fromAlias,
  toAddress: testRecipient,
  subject: testSubject,
  content: "This is a DLride Ops Zoho Mail API connection test.",
});
console.log(`Send email: passed (${configuration.fromAlias})`);

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

let replyMessageId = environment("ZOHO_TEST_REPLY_MESSAGE_ID");
let replyRecipient = environment("ZOHO_TEST_REPLY_TO_EMAIL");
let testThreadId: string | null = null;

if (!replyMessageId || !replyRecipient) {
  if (testRecipient.toLowerCase() !== configuration.mailAddress) {
    throw new Error(
      "ZOHO_TEST_REPLY_MESSAGE_ID and ZOHO_TEST_REPLY_TO_EMAIL are required unless the test recipient is the connected mailbox",
    );
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (attempt > 0) await wait(1_000);
    const recent = await listRecentZohoMessages(client, configuration.accountId, 20);
    const testMessage = recent.find((message) => message.subject === testSubject);
    if (testMessage) {
      replyMessageId = testMessage.message_id;
      replyRecipient = configuration.fromAlias;
      testThreadId = testMessage.thread_id;
      break;
    }
  }
}

if (!replyMessageId || !replyRecipient) {
  throw new Error("The self-addressed Zoho test message was not available for reply");
}

await replyToZohoMessage(client, configuration.accountId, {
  messageId: replyMessageId,
  fromAddress: configuration.fromAlias,
  toAddress: replyRecipient,
  subject: `Re: ${testSubject}`,
  content: "This reply was sent through the Zoho reply endpoint.",
});

if (testThreadId) {
  let threadVerified = false;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await wait(1_000);
    const recent = await listRecentZohoMessages(client, configuration.accountId, 20);
    if (recent.filter((message) => message.thread_id === testThreadId).length >= 2) {
      threadVerified = true;
      break;
    }
  }
  if (!threadVerified) {
    throw new Error("Zoho accepted the reply but its conversation thread could not be verified");
  }
}

console.log(`Reply in existing conversation: passed (message ${replyMessageId})`);
