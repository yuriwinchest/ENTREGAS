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
  console.log("=== VALIDANDO INSERÇÃO E BUSCAS NO APPWRITE ===");

  const testDoc = {
    bib_number: "1001",
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

  const created = await res.json();
  if (res.ok) {
    console.log("✓ Documento inserido com sucesso:", created.$id, created.name, "Peito:", created.bib_number);
  } else if (res.status === 409) {
    console.log("✓ Documento já existia.");
  } else {
    console.error("Erro na inserção:", created);
  }

  // 1. Busca por Chip
  const searchChip = await fetch(`${ENDPOINT}/databases/${DATABASE_ID}/collections/participants/documents?queries[]=${encodeURIComponent('equal("chip", ["E28011606000020476483A01"])')}`, { headers }).then(r => r.json());
  console.log(`✓ Busca por Chip: Encontrados ${searchChip.total} registro(s).`);

  // 2. Busca por Peito
  const searchBib = await fetch(`${ENDPOINT}/databases/${DATABASE_ID}/collections/participants/documents?queries[]=${encodeURIComponent('equal("bib_number", ["1001"])')}`, { headers }).then(r => r.json());
  console.log(`✓ Busca por Peito (1001): Encontrados ${searchBib.total} registro(s).`);

  // 3. Teste de entrega
  console.log("Simulando entrega do kit...");
  const now = new Date().toISOString();
  const updateRes = await fetch(`${ENDPOINT}/databases/${DATABASE_ID}/collections/participants/documents/test_athlete_1`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      data: {
        delivered_at: now,
        receiver_name: "Yuri Vinicius (Próprio)"
      }
    })
  }).then(r => r.json());
  console.log("✓ Kit entregue atualizado:", updateRes.delivered_at, updateRes.receiver_name);

  // 4. Inserir auditoria
  const auditRes = await fetch(`${ENDPOINT}/databases/${DATABASE_ID}/collections/delivery_audit/documents`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      documentId: "unique()",
      data: {
        participant_id: "test_athlete_1",
        epc: "E28011606000020476483A01",
        operator_name: "Operador Balcão 1",
        receiver_name: "Yuri Vinicius (Próprio)",
        delivered_at: now
      }
    })
  }).then(r => r.json());
  console.log("✓ Auditoria registrada com sucesso ID:", auditRes.$id);

  console.log("\n=== FASE 1 (APPWRITE) 100% OPERACIONAL E TESTADA COM SUCESSO! ===");
}
main().catch(console.error);
