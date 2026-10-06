const safeJSON = (value) => JSON.stringify(value).replaceAll("<", "\\u003c");
export function paymentPage({ booking: b, config: cfg, token, nonce }) {
  return `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>ANVIRA secure payment</title><style>body{font:16px system-ui;background:#F7F7F2;color:#172E29;margin:0;padding:24px}main{max-width:420px;margin:40px auto;background:white;padding:28px;border-radius:24px}button{background:#12634F;color:white;border:0;border-radius:16px;padding:16px;width:100%;font:600 16px system-ui}button:disabled{opacity:.6}p{line-height:1.6}.test{background:#FFF0D8;padding:14px;border-radius:12px;color:#8F5B19}</style></head><body><main><h1>ANVIRA</h1>${cfg.paymentEnvironment === "test" ? '<p class="test"><strong>Razorpay test mode</strong><br>No real money is collected. Use test payment details only.</p>' : ""}<p>Secure service payment</p><h2>₹${b.total}</h2><p id="message" role="status" aria-live="polite">Complete your payment to confirm your booking.</p><button id="pay">Continue to secure checkout</button><p>Closing checkout leaves the booking pending. Check its status before trying again.</p></main><script src="https://checkout.razorpay.com/v1/checkout.js" nonce="${nonce}"></script><script nonce="${nonce}">
const options=${safeJSON({ key: cfg.razorpayKeyId, order_id: b.orderId, amount: b.total * 100, currency: "INR", name: "ANVIRA", description: "Home service booking", theme: { color: "#12634F" } })};
const message=document.getElementById('message'),pay=document.getElementById('pay');
options.handler=async function(response){
  pay.disabled=true;message.textContent='Verifying payment. Please wait.';
  try {
    const r=await fetch(location.origin+'/api/checkout/${token}/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(response)});
    const d=await r.json();
    message.textContent=r.ok?(d.status==='payment_pending'?'Payment is awaiting capture. Check your booking for confirmation.':'Payment verified. Return to ANVIRA to view your booking.'):d.error||'Verification pending. Check your booking before paying again.';
    if(r.ok&&window.opener)window.opener.postMessage({type:'ANVIRA_PAYMENT',bookingId:${safeJSON(b.id)}},${safeJSON(cfg.webReturn)});
  } catch { message.textContent='Verification could not finish. Check your booking status before paying again.'; }
};
options.modal={ondismiss:()=>{message.textContent='Checkout closed. Your booking remains pending until payment is confirmed.'}};
pay.onclick=()=>{
  if(typeof Razorpay==='undefined'){message.textContent='Secure checkout could not load. Check your connection and try again.';return;}
  try {const checkout=new Razorpay(options);checkout.on('payment.failed',()=>{message.textContent='Payment failed. Your booking is still pending; you can retry this checkout.';pay.disabled=false;});checkout.open();}
  catch {message.textContent='Secure checkout is unavailable. Check your booking before retrying.';}
};
</script></body></html>`;
}
