import { ensureChromeRunning } from "./test-chrome";

async function testOperatorAndBid() {
  // 1. Admin login
  const loginRes = await fetch("http://127.0.0.1:8081/api/auth/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "Detailing@2026" }),
  });
  const cookie = loginRes.headers.get("set-cookie") || "";
  console.log("Admin logged in. Cookie length:", cookie.length);

  // 2. Put next player on stage
  const nextRes = await fetch("http://127.0.0.1:8081/api/tournaments/18/auction/next-player", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ mode: "sequential" }),
  });
  const nextData = await nextRes.json();
  console.log("Next player response status:", nextRes.status, nextData);

  // 3. Check auction state
  const stateRes = await fetch("http://127.0.0.1:8081/api/tournaments/18/auction");
  const state = await stateRes.json();
  console.log("Current player on stage:", state.currentPlayer?.name, "Base price:", state.currentPlayer?.basePrice);

  // 4. Mark unsold so we reset cleanly for our full simulation
  const unsoldRes = await fetch("http://127.0.0.1:8081/api/tournaments/18/auction/unsold", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
  });
  console.log("Unsold status:", unsoldRes.status);
}

testOperatorAndBid().catch(console.error);
