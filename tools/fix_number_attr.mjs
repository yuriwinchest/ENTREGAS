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
  console.log("Removendo atributo 'number' com falha...");
  await fetch(`${ENDPOINT}/databases/${DATABASE_ID}/collections/participants/attributes/number`, {
    method: "DELETE",
    headers
  }).then(r => r.json()).then(console.log).catch(console.error);

  console.log("Criando atributo 'bib_number'...");
  const res = await fetch(`${ENDPOINT}/databases/${DATABASE_ID}/collections/participants/attributes/string`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      key: "bib_number",
      size: 32,
      required: true,
      default: null,
      array: false
    })
  });
  console.log("Status bib_number:", await res.json());
}
main();
