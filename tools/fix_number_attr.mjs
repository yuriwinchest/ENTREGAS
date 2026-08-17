const ENDPOINT = "https://db.largadabrasil.com/v1";
const PROJECT_ID = "6a8238cc001997d3b0c8";
const API_KEY = "standard_2f3823db905e363eba8ce9efb026ac22ecaf1624f142d2c22ee1d303fa498ea72cb863df7f649b32f438c94d2b4d157dd5887657b1233c2cfedab6fe30128d9c9632459b6e2f3dc3603cf2bf5e7c8429ee41bf038652c5b431cb9f94104506351897e11478f32adef5323f37d4073bcd44791824579757c5e092d34a98e67135";
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
