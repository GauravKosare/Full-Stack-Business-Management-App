export const razorpayTestPageHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Razorpay connection test</title>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
</head>
<body style="font-family: sans-serif; max-width: 480px; margin: 60px auto; padding: 0 16px;">
  <h1>Razorpay connection test</h1>
  <p>Pays &#8377;1.00 (100 paise) in Razorpay <strong>test mode</strong> — no real money moves.</p>
  <p>Test card: <code>4111 1111 1111 1111</code> · CVV <code>123</code> · Expiry <code>12/26</code><br/>
     Test UPI: <code>test@razorpay</code></p>
  <button id="pay-btn" style="padding: 10px 20px; font-size: 16px;">Pay &#8377;1 (test)</button>
  <pre id="result" style="white-space: pre-wrap; margin-top: 20px; background: #f5f5f5; padding: 12px; border-radius: 6px;"></pre>

  <script>
    const resultEl = document.getElementById("result");
    document.getElementById("pay-btn").addEventListener("click", async () => {
      resultEl.textContent = "Creating order...";
      try {
        const orderRes = await fetch("/api/v1/razorpay-test/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 100 }),
        });
        const order = await orderRes.json();
        if (!orderRes.ok) throw new Error((order.error && order.error.message) || "Order creation failed");

        resultEl.textContent = "Order created: " + order.orderId + "\\nOpening checkout...";

        const rzp = new window.Razorpay({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          order_id: order.orderId,
          name: "Business Management App (test)",
          handler: async function (response) {
            resultEl.textContent = "Verifying signature...";
            const verifyRes = await fetch("/api/v1/razorpay-test/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });
            const verify = await verifyRes.json();
            resultEl.textContent = verifyRes.ok
              ? "Payment verified! " + JSON.stringify(verify, null, 2)
              : "Verification FAILED: " + JSON.stringify(verify, null, 2);
          },
          modal: {
            ondismiss: function () {
              resultEl.textContent = "Checkout dismissed (cancelled by user).";
            },
          },
        });

        rzp.on("payment.failed", function (resp) {
          resultEl.textContent = "Payment failed: " + JSON.stringify(resp.error, null, 2);
        });

        rzp.open();
      } catch (err) {
        resultEl.textContent = "Error: " + err.message;
      }
    });
  </script>
</body>
</html>
`;
