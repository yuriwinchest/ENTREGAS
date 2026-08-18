const ENDPOINT = "https://db.largadabrasil.com/v1";
const PROJECT_ID = "6a8238cc001997d3b0c8";
const API_KEY = process.env.APPWRITE_API_KEY;
const DATABASE_ID = "chipower_entregas";

const headers = {
  "X-Appwrite-Project": PROJECT_ID,
  "X-Appwrite-Key": API_KEY,
  "Content-Type": "application/json"
};

async function api(path, method = "GET", body = null) {
  const options = {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  };
  const res = await fetch(`${ENDPOINT}${path}`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(`[${res.status}] ${data.message || res.statusText}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function main() {
  const cols = ["participants", "delivery_audit", "event_settings"];
  for (const c of cols) {
    const col = await api(`/databases/${DATABASE_ID}/collections/${c}`);
    console.log(`\nColeção ${c}:`);
    for (const a of col.attributes) {
      console.log(`  - Atributo ${a.key}: ${a.status}`);
    }
  }
}
main();
