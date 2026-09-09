-- AlterTable: name passa a ser unico (usado tambem para login, ver auth.routes.ts)
CREATE UNIQUE INDEX "users_name_key" ON "users"("name");
