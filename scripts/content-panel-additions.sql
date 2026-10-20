-- AlterTable
ALTER TABLE "ContentWeek" ADD COLUMN IF NOT EXISTS "strategyPdfName" TEXT,
ADD COLUMN IF NOT EXISTS "strategyPdfUrl" TEXT,
ADD COLUMN IF NOT EXISTS "weekStoriesInstructions" TEXT DEFAULT '';

-- AlterTable
ALTER TABLE "ContentPiece" ADD COLUMN IF NOT EXISTS "igMediaId" TEXT,
ADD COLUMN IF NOT EXISTS "metricsLikes" INTEGER;

-- AlterTable
ALTER TABLE "ClinicalCase" ADD COLUMN IF NOT EXISTS "achievements" TEXT,
ADD COLUMN IF NOT EXISTS "achievementsVideos" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS "aiDraftedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "initialSituation" TEXT,
ADD COLUMN IF NOT EXISTS "initialSituationVideos" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS "obstacles" TEXT,
ADD COLUMN IF NOT EXISTS "obstaclesVideos" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS "process" TEXT,
ADD COLUMN IF NOT EXISTS "processVideos" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS "shortSummary" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ContentStoryTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "jsonSlides" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentStoryTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StoryTemplateSlot" (
    "id" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "formatName" TEXT NOT NULL,
    "emoji" TEXT,
    "color" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryTemplateSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StoryIdea" (
    "id" TEXT NOT NULL,
    "templateSlotId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryIdea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CarouselLibraryEntry" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "category" TEXT,
    "slidesJson" TEXT NOT NULL,
    "captionText" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarouselLibraryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CarouselVisualTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slideJson" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarouselVisualTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Carousel" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "category" TEXT,
    "slidesJson" TEXT NOT NULL,
    "captionText" TEXT,
    "visualJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Carousel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ContentStoryTemplate_createdById_updatedAt_idx" ON "ContentStoryTemplate"("createdById", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "StoryTemplateSlot_dayOfWeek_key" ON "StoryTemplateSlot"("dayOfWeek");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StoryTemplateSlot_dayOfWeek_idx" ON "StoryTemplateSlot"("dayOfWeek");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StoryIdea_templateSlotId_done_order_idx" ON "StoryIdea"("templateSlotId", "done", "order");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CarouselLibraryEntry_category_idx" ON "CarouselLibraryEntry"("category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CarouselLibraryEntry_createdAt_idx" ON "CarouselLibraryEntry"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CarouselVisualTemplate_createdAt_idx" ON "CarouselVisualTemplate"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Carousel_status_idx" ON "Carousel"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Carousel_createdAt_idx" ON "Carousel"("createdAt");

-- AddForeignKey
ALTER TABLE "StoryIdea" ADD CONSTRAINT "StoryIdea_templateSlotId_fkey" FOREIGN KEY ("templateSlotId") REFERENCES "StoryTemplateSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

