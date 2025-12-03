/*
  Warnings:

  - A unique constraint covering the columns `[paystackAuthorizationCode]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[paystackReferenceCode]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Made the column `name` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "paystackAuthorizationCode" TEXT,
ADD COLUMN     "paystackReferenceCode" TEXT,
ALTER COLUMN "name" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_paystackAuthorizationCode_key" ON "User"("paystackAuthorizationCode");

-- CreateIndex
CREATE UNIQUE INDEX "User_paystackReferenceCode_key" ON "User"("paystackReferenceCode");
