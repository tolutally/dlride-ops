export type Fetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type ZohoOAuthConfiguration = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accountsBaseUrl: string;
};

export type ZohoMailConfiguration = ZohoOAuthConfiguration & {
  accountId: string;
  mailAddress: string;
  fromAlias: string;
  mailApiBaseUrl: string;
};

export type ZohoSetupConfiguration = {
  enabled: boolean;
  setupSecret: string;
  clientId: string;
  clientSecret: string;
  accountsBaseUrl: string;
  mailApiBaseUrl?: string;
  mailAddress: string;
  fromAlias: string;
  redirectUri?: string;
};

export type ZohoTokenResult = {
  accessToken: string;
  expiresIn: number;
  apiDomain?: string;
  refreshToken?: string;
};

export type ZohoSendAddress = {
  address: string;
  displayName: string | null;
  enabled: boolean;
};

export type ZohoMailAccount = {
  accountId: string;
  mailboxAddress: string;
  primaryEmailAddress: string;
  emailAddresses: string[];
  sendAddresses: ZohoSendAddress[];
};

export type ZohoMessageSummary = {
  message_id: string;
  folder_id: string;
  thread_id: string | null;
  sender: string;
  recipient: string;
  subject: string;
  received_at: string;
  has_attachments: boolean;
};

export type ZohoMessageHeaders = {
  message_id: string;
  message_id_header: string | null;
  in_reply_to: string | null;
  from: string | null;
  to: string | null;
};

export type ZohoAttachment = {
  attachment_id: string;
  filename: string;
  size: number;
};

export type ZohoAttachmentContent = {
  bytes: Uint8Array;
  content_type: string | null;
};

export type ZohoMessageContent = {
  message_id: string;
  folder_id: string;
  content: string;
};

export type ZohoSendMessageInput = {
  fromAddress: string;
  toAddress: string;
  subject: string;
  content: string;
  mailFormat?: "html" | "plaintext";
  attachments?: ZohoUploadedAttachment[];
};

export type ZohoUploadedAttachment = {
  storeName: string;
  attachmentName: string;
  attachmentPath: string;
};

export type ZohoReplyInput = ZohoSendMessageInput & {
  messageId: string;
};
