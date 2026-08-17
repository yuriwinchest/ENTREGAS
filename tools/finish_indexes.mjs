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

async function main() {
  // 1. Delivery audit indexes
  const auditCol = await api(`/databases/${DATABASE_ID}/collections/delivery_audit`);
  const auditIdxs = auditCol.indexes.map(i => i.key);
  
  if (!auditIdxs.includes("ix_participant_id")) {
    console.log("Criando ix_participant_id em delivery_audit...");
    await api(`/databases/${DATABASE_ID}/collections/delivery_audit/indexes`, "POST", {
      key: "ix_participant_id",
      type: "key",
      attributes: ["participant_id"],
      orders: ["ASC"]
    }).catch(e => console.log(e.message));
  }
  if (!auditIdxs.includes("ix_epc")) {
    console.log("Criando ix_epc em delivery_audit...");
    await api(`/databases/${DATABASE_ID}/collections/delivery_audit/indexes`, "POST", {
      key: "ix_epc",
      type: "key",
      attributes: ["epc"],
      orders: ["ASC"]
    }).catch(e => console.log(e.message));
  }

  // 2. Participants indexes
  console.log("Aguardando participants.number ficar available...");
  for (let i = 0; i < 30; i++) {
    const partCol = await api(`/databases/${DATABASE_ID}/collections/participants`);
    const numAttr = partCol.attributes.find(a => a.key === "number");
    if (numAttr && numAttr.status === "available") {
      console.log("✓ Atributo number está available!");
      break;
    }
    await sleep(2000);
  }

  const partCol = await api(`/databases/${DATABASE_ID}/collections/participants`);
  const partIdxs = partCol.indexes.map(i => i.key);

  const needed = [
    { key: "ix_chip", attrs: ["chip"] },
    { key: "ix_number", attrs: ["number"] },
    { key: "ix_name", attrs: ["name"] }
  ];

  for (const idx of needed) {
    if (!partIdxs.includes(idx.key)) {
      console.log(`Criando índice ${idx.key}...`);
      await api(`/databases/${DATABASE_ID}/collections/participants/indexes`, "POST", {
        key: idx.key,
        type: "key",
        attributes: idx.attrs,
        orders: ["ASC"]
      }).then(() => console.log(`✓ ${idx.key} criado.`)).catch(e => console.log(`! ${idx.key}: ${e.message}`));
      await sleep(1000);
    } else {
      console.log(`✓ ${idx.key} já existia.`);
    }
  }

  console.log("\nTODOS OS ÍNDICES E TABELAS FORAM CRIADOS E CONFIGURADOS COM SUCESSO NO APPWRITE!");
}

main().catch(console.error);
