import {
  resolvePicks,
  type BookImportInput,
  type ContentsMap,
  type JobQueue,
} from "@ovenlovin/core/jobs";

export type BookContentsView = {
  jobId: string;
  name: string;
  pages: number;
  status: "reading" | "ready" | "failed";
  error: string | null;
  map: ContentsMap | null;
  picks: string[];
};

/** What the contents screen needs: the map once the contents step is done, plus saved picks. */
export async function loadBookContents(
  queue: JobQueue,
  jobId: string,
  householdId: string
): Promise<BookContentsView | null> {
  const job = await queue.get(jobId);
  if (!job || job.householdId !== householdId || job.kind !== "book_import") return null;
  const input = job.input as BookImportInput & { picks?: string[] };
  const items = await queue.items(jobId);
  const failed = items.find((item: any) => item.status === "failed");
  const contents = items.find((item: any) => item.payload?.step === "contents");
  const map = contents?.status === "done" ? (contents.result as ContentsMap) : null;

  const status = map ? "ready" : failed ? "failed" : "reading";
  return {
    jobId,
    name: input.name,
    pages: input.pages,
    status,
    error: status === "failed" ? (failed?.error ?? null) : null,
    map,
    picks: map ? resolvePicks(map.candidates, input.picks) : [],
  };
}
