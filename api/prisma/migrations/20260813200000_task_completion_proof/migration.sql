ALTER TABLE "tasks" ADD COLUMN "requires_proof" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "task_completion_proofs" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "file_path" TEXT,
    "file_name" TEXT,
    "file_size" INTEGER,
    "file_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_completion_proofs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "task_completion_proofs_task_id_user_id_key" ON "task_completion_proofs"("task_id", "user_id");

ALTER TABLE "task_completion_proofs" ADD CONSTRAINT "task_completion_proofs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "task_completion_proofs" ADD CONSTRAINT "task_completion_proofs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
