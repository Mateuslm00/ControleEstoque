-- AlterTable
ALTER TABLE "materials" ADD COLUMN     "group" TEXT,
ADD COLUMN     "markup" DECIMAL(6,2) NOT NULL DEFAULT 30,
ADD COLUMN     "type" TEXT;

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "contact_person" TEXT;
