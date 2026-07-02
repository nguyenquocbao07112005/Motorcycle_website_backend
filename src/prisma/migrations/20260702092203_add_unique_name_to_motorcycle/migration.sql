/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `Motorcycle` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Motorcycle_name_key" ON "Motorcycle"("name");
