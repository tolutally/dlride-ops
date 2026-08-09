export type UnreadReplyNotification = {
  id: string;
  applicationId: string;
  applicationNumber: string;
  customerName: string;
  preview: string;
  receivedAt: string;
};

export type UnreadReplySnapshot = {
  total: number;
  items: UnreadReplyNotification[];
  generatedAt: string;
};

export const UNREAD_REPLIES_READ_EVENT = "dlride:unread-replies-read";

