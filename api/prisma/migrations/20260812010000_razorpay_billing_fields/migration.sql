-- DropIndex
DROP INDEX "businesses_stripe_customer_id_key";

-- DropIndex
DROP INDEX "invoices_stripe_invoice_id_key";

-- DropIndex
DROP INDEX "subscriptions_stripe_subscription_id_key";

-- AlterTable
ALTER TABLE "businesses" DROP COLUMN "stripe_customer_id";

-- AlterTable
ALTER TABLE "invoices" DROP COLUMN "stripe_invoice_id",
ADD COLUMN     "razorpay_payment_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "subscriptions" DROP COLUMN "stripe_subscription_id",
ADD COLUMN     "razorpay_subscription_id" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "invoices_razorpay_payment_id_key" ON "invoices"("razorpay_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_razorpay_subscription_id_key" ON "subscriptions"("razorpay_subscription_id");
