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
  const options = {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  };
  const res = await fetch(`${ENDPOINT}${path}`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(`[${res.status}] ${data.message || res.statusText}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForAttributes(colId) {
  for (let attempt = 1; attempt <= 20; attempt++) {
    const col = await api(`/databases/${DATABASE_ID}/collections/${colId}`);
    const pending = col.attributes.filter((a) => a.status === "processing");
    if (pending.length === 0) {
      console.log(`  ✓ Todos os atributos da coleção '${colId}' estão prontos (available).`);
      return col;
    }
    console.log(`  ... aguardando ${pending.length} atributos serem processados (tentativa ${attempt})...`);
    await sleep(2000);
  }
  throw new Error(`Timeout aguardando atributos da coleção '${colId}'`);
}

async function main() {
  console.log("=== FINALIZANDO CRIAÇÃO DE ÍNDICES NO APPWRITE ===");

  const indexes = [
    {
      colId: "participants",
      indexes: [
        { key: "ix_chip", type: "key", attributes: ["chip"] },
        { key: "ix_number", type: "key", attributes: ["number"] },
        { key: "ix_name", type: "key", attributes: ["name"] }
      ]
    },
    {
      colId: "delivery_audit",
      indexes: [
        { key: "ix_participant_id", type: "key", attributes: ["participant_id"] },
        { key: "ix_epc", type: "key", attributes: ["epc"] }
      ]
    }
  ];

  for (const item of indexes) {
    console.log(`\nVerificando coleção '${item.colId}'...`);
    const col = await waitForAttributes(item.colId);
    const existingIndexes = col.indexes.map((i) => i.key);

    for (const idx of item.indexes) {
      if (existingIndexes.includes(idx.key)) {
        console.log(`  ✓ Índice '${idx.key}' já existe.`);
        continue;
      }

      console.log(`  + Criando índice '${idx.key}' (${idx.attributes.join(", ")})...`);
      try {
        await api(`/databases/${DATABASE_ID}/collections/${item.colId}/indexes`, "POST", {
          key: idx.key,
          type: idx.type,
          attributes: idx.attributes,
          orders: idx.attributes.map(() => "ASC")
        });
        console.log(`  ✓ Índice '${idx.key}' criado com sucesso.`);
        await sleep(1000);
      } catch (err) {
        if (err.status === 409) {
          console.log(`  ✓ Índice '${idx.key}' já existia.`);
        } else {
          console.error(`  ❌ Erro ao criar índice '${idx.key}':`, err.message);
        }
      }
    }
  }

  // Inserir um registro de teste de configurações do evento se não existir
  console.log("\nConfigurando evento inicial...");
  try {
    const settings = await api(`/databases/${DATABASE_ID}/collections/event_settings/documents`);
    if (settings.total === 0) {
      await api(`/databases/${DATABASE_ID}/collections/event_settings/documents`, "POST", {
        documentId: "default",
        data: {
          event_name: "CHIPOWER - Entrega de Kits Oficial",
          reader_ip: "192.168.0.33",
          banner_url: "",
          active: true
        }
      });
      console.log("✓ Documento de configuração padrão criado no Appwrite.");
    } else {
      console.log("✓ Documento de configuração já existe.");
    }
  } catch (err) {
    console.warn("Aviso ao criar documento de evento:", err.message);
  }

  console.log("\n=== APPWRITE TOTALMENTE CONFIGURADO E OPERACIONAL! ===");
}

main().catch((err) => {
  console.error("Erro:", err);
  process.exit(1);
});
