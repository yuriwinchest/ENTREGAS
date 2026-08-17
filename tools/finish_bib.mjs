const ENDPOINT = "https://db.largadabrasil.com/v1";
const PROJECT_ID = "6a8238cc001997d3b0c8";
const API_KEY = "standard_2f3823db905e363eba8ce9efb026ac22ecaf1624f142d2c22ee1d303fa498ea72cb863df7f649b32f438c94d2b4d157dd5887657b1233c2cfedab6fe30128d9c9632459b6e2f3dc3603cf2bf5e7c8429ee41bf038652c5b431cb9f94104506351897e11478f32adef5323f37d4073bcd44791824579757c5e092d34a98e67135";
const DATABASE_ID = "chipower_entregas";

const headers = {
  "X-Appwrite-Project": PROJECT_ID,
  "X-Appwrite-Key": API_KEY,
  "Content-Type": "application/json"
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log("Aguardando bib_number ficar available...");
  for (let i = 0; i < 15; i++) {
    const col = await fetch(`${ENDPOINT}/databases/${DATABASE_ID}/collections/participants`, { headers }).then(r => r.json());
    const attr = col.attributes.find(a => a.key === "bib_number");
    if (attr && attr.status === "available") {
      console.log("✓ bib_number está available!");
      break;
    }
    await sleep(1500);
  }

  console.log("Criando índice ix_bib_number...");
  const res = await fetch(`${ENDPOINT}/databases/${DATABASE_ID}/collections/participants/indexes`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      key: "ix_bib_number",
      type: "key",
      attributes: ["bib_number"],
      orders: ["ASC"]
    })
  });
  console.log("Resultado índice:", await res.json());
}
main();
