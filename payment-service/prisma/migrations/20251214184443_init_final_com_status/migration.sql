-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('CREDITO', 'DEBITO', 'PIX', 'BOLETO');

-- CreateTable
CREATE TABLE "public"."payments" (
    "id" SERIAL NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentMethod" "public"."PaymentMethod",
    "status" TEXT NOT NULL DEFAULT 'PENDING_PROCESS',
    "value" DECIMAL(10,2) NOT NULL,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);
