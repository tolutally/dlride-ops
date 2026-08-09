import { notFound } from "next/navigation";

import { ApplicationDetail } from "@/components/applications/application-detail";
import { fetchApplicationDetail } from "@/lib/applications/detail";

export default async function ApplicationDetailPage({ params }: PageProps<"/applications/[id]">) {
  const { id } = await params;
  const result = await fetchApplicationDetail(id);

  if (!result) notFound();

  return (
    <ApplicationDetail
      application={result.application}
      activity={result.activity}
      conversation={result.conversation}
    />
  );
}
