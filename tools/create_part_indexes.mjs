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
  const res = await fetch(`${ENDPOINT}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`[${res.status}] ${data.message || res.statusText}`);
  return data;
}

async function main() {
  console.log("Tentando criar índice ix_chip...");
  await api(`/databases/${DATABASE_ID}/collections/participants/indexes`, "POST", {
    key: "ix_chip",
    type: "key",
    attributes: ["chip"],
    orders: ["ASC"]
  }).then(() => console.log("✓ ix_chip criado.")).catch(e => console.log(e.message));

  console.log("Tentando criar índice ix_name...");
  await api(`/databases/${DATABASE_ID}/collections/participants/indexes`, "POST", {
    key: "ix_name",
    type: "key",
    attributes: ["name"],
    orders: ["ASC"]
  }).then(() => console.log("✓ ix_name criado.")).catch(e => console.log(e.message));
}
main();
