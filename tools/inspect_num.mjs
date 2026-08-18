const ENDPOINT = "https://db.largadabrasil.com/v1";
const PROJECT_ID = "6a8238cc001997d3b0c8";
const API_KEY = process.env.APPWRITE_API_KEY;
const DATABASE_ID = "chipower_entregas";

const headers = {
  "X-Appwrite-Project": PROJECT_ID,
  "X-Appwrite-Key": API_KEY,
  "Content-Type": "application/json"
};

async function main() {
  const col = await fetch(`${ENDPOINT}/databases/${DATABASE_ID}/collections/participants`, { headers }).then(r => r.json());
  console.log("Atributos de participants:", JSON.stringify(col.attributes.map(a => ({ key: a.key, status: a.status, error: a.error })), null, 2));
}
main();
