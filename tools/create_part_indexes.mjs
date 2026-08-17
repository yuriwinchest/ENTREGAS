const ENDPOINT = "https://db.largadabrasil.com/v1";
const PROJECT_ID = "6a8238cc001997d3b0c8";
const API_KEY = "standard_2f3823db905e363eba8ce9efb026ac22ecaf1624f142d2c22ee1d303fa498ea72cb863df7f649b32f438c94d2b4d157dd5887657b1233c2cfedab6fe30128d9c9632459b6e2f3dc3603cf2bf5e7c8429ee41bf038652c5b431cb9f94104506351897e11478f32adef5323f37d4073bcd44791824579757c5e092d34a98e67135";
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
