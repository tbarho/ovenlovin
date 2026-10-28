import { PermanentJobError, type JobHandlers } from "@ovenlovin/core/jobs";
import { mapBookContents } from "@/lib/book-contents";
import { extractBookRecipe } from "@/lib/book-recipes";
import { verifyBookImport } from "@/lib/book-import-verify";
import { jobQueue } from "@/lib/jobs";

/** Step handlers. Only the worker imports these: they pull in pdf.js and the importers. */
export const jobHandlers: JobHandlers = {
  book_import: async (item) => {
    if (item.payload?.step === "verify") {
      return verifyBookImport(jobQueue(), item);
    }
    if (item.payload?.step === "contents") {
      return mapBookContents(jobQueue(), item);
    }
    if (item.payload?.step === "recipe") {
      return extractBookRecipe(jobQueue(), item);
    }
    throw new PermanentJobError(`No book_import step for ${JSON.stringify(item.payload)}`);
  },
};
