-- Add composite rendering settings to VideoSet
ALTER TABLE "VideoSet" ADD COLUMN "layout"  TEXT    NOT NULL DEFAULT 'horizontal';
ALTER TABLE "VideoSet" ADD COLUMN "cropX"   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VideoSet" ADD COLUMN "cropY"   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VideoSet" ADD COLUMN "padding" INTEGER NOT NULL DEFAULT 0;
