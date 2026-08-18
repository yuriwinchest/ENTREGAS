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
  console.log("=== TESTANDO INSERÇÃO E CONSULTA NO APPWRITE ===");
  const testDoc = {
    number: "1001",
    chip: "E28011606000020476483A01",
    name: "YURI VINICIUS SILVA",
    name_folded: "YURI VINICIUS SILVA",
    cpf: "123.456.789-00",
    birth_date: "1990-05-15",
    sex: "M",
    shirt: "G",
    modality: "Corrida 10K",
    category: "M30-34",
    delivered_at: null,
    receiver_name: null
  };

  const res = await fetch(`${ENDPOINT}/databases/${DATABASE_ID}/collections/participants/documents`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      documentId: "test_athlete_1",
      data: testDoc
    })
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("Falha ao criar documento teste:", data);
  } else {
    console.log("✓ Documento de teste criado com sucesso:", data.$id, data.name);
  }

  // Consultar por chip
  const search = await fetch(`${ENDPOINT}/databases/${DATABASE_ID}/collections/participants/documents?queries[]=${encodeURIComponent('equal("chip", ["E28011606000020476483A01"])')}`, {
    headers
  }).then(r => r.json());

  console.log(`✓ Consulta por chip retornou ${search.total} registros.`);
}
main();
