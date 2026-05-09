-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VideoSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VideoSet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "videoSetId" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    CONSTRAINT "Video_videoSetId_fkey" FOREIGN KEY ("videoSetId") REFERENCES "VideoSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SurveyTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "setsPerSurvey" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SurveyTemplate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TemplatePage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    CONSTRAINT "TemplatePage_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SurveyTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TemplateElement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pageId" TEXT NOT NULL,
    "elementType" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    CONSTRAINT "TemplateElement_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "TemplatePage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Survey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'generating',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Survey_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SurveyTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Survey_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SurveyVideoSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "surveyId" TEXT NOT NULL,
    "videoSetId" TEXT NOT NULL,
    "positionIndex" INTEGER NOT NULL,
    "slotMap" TEXT NOT NULL,
    "compositeUrl" TEXT,
    "compositeStatus" TEXT NOT NULL DEFAULT 'pending',
    CONSTRAINT "SurveyVideoSet_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SurveyVideoSet_videoSetId_fkey" FOREIGN KEY ("videoSetId") REFERENCES "VideoSet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RespondentSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "surveyId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "RespondentSession_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Response" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "surveyVideoSetId" TEXT,
    "elementId" TEXT NOT NULL,
    "slotLabel" TEXT,
    "value" TEXT NOT NULL,
    CONSTRAINT "Response_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RespondentSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Response_surveyVideoSetId_fkey" FOREIGN KEY ("surveyVideoSetId") REFERENCES "SurveyVideoSet" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Response_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "TemplateElement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Survey_slug_key" ON "Survey"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "RespondentSession_token_key" ON "RespondentSession"("token");
