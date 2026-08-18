const ENDPOINT = "https://db.largadabrasil.com/v1";
const PROJECT_ID = "6a8238cc001997d3b0c8";
const API_KEY = process.env.APPWRITE_API_KEY;
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
