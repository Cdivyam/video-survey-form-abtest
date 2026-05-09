-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Response" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "surveyVideoSetId" TEXT,
    "elementId" TEXT,
    "slotLabel" TEXT,
    "value" TEXT NOT NULL,
    CONSTRAINT "Response_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RespondentSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Response_surveyVideoSetId_fkey" FOREIGN KEY ("surveyVideoSetId") REFERENCES "SurveyVideoSet" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Response_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "TemplateElement" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Response" ("elementId", "id", "sessionId", "slotLabel", "surveyVideoSetId", "value") SELECT "elementId", "id", "sessionId", "slotLabel", "surveyVideoSetId", "value" FROM "Response";
DROP TABLE "Response";
ALTER TABLE "new_Response" RENAME TO "Response";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
