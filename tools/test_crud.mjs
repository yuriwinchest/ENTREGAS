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
