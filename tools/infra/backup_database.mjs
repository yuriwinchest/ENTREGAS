/**
 * Backup e restauração do banco do CHIPOWER.
 *
 * Existe porque a instância self-hosted do Appwrite não tem a API de backup
 * habilitada — sem isso, não há de onde voltar.
 *
 * Backup:
 *   APPWRITE_API_KEY="..." node tools/infra/backup_database.mjs
 *   APPWRITE_API_KEY="..." node tools/infra/backup_database.mjs --saida ./backups
 *
 * Restauração (só recria o que não existe mais; NUNCA apaga nada):
 *   APPWRITE_API_KEY="..." node tools/infra/backup_database.mjs --restaurar ./backups/2026-08-18T01-00-00.json
 *   ... --restaurar <arquivo> --collection participants
 */

import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DATABASE_ID, request, listAllDocuments, pool } from "../lib/appwrite-admin.mjs";

const COLLECTIONS = [
  "tenants",
  "operators",
  "events",
  "participants",
  "delivery_audit",
  "event_settings"
];

const argumento = (nome, padrao = null) => {
  const i = process.argv.indexOf(nome);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : padrao;
};

/** Campos de metadados do Appwrite que não podem ser reenviados como dados. */
const CAMPOS_META = ["$id", "$sequence", "$collectionId", "$databaseId", "$createdAt", "$updatedAt", "$permissions"];

const separarDocumento = (doc) => {
  const dados = { ...doc };
  for (const campo of CAMPOS_META) delete dados[campo];
  return { id: doc.$id, permissoes: doc.$permissions || [], dados };
};

async function fazerBackup(destino, carimbo) {
  mkdirSync(destino, { recursive: true });

  const conteudo = { gerado_em: carimbo, database: DATABASE_ID, collections: {} };
  let total = 0;

  for (const collectionId of COLLECTIONS) {
    try {
      const docs = await listAllDocuments(collectionId);
      conteudo.collections[collectionId] = docs.map(separarDocumento);
      total += docs.length;
      console.log(`  [+] ${collectionId}: ${docs.length} documento(s)`);
    } catch (err) {
      console.warn(`  [!] ${collectionId}: ${err.message}`);
      conteudo.collections[collectionId] = [];
    }
  }

  const arquivo = resolve(destino, `${carimbo}.json`);
  writeFileSync(arquivo, JSON.stringify(conteudo, null, 2), "utf8");

  console.log(`\n=== BACKUP CONCLUÍDO ===`);
  console.log(`${total} documento(s) em ${arquivo}`);
  return arquivo;
}

async function restaurar(arquivo, somenteCollection) {
  const conteudo = JSON.parse(readFileSync(arquivo, "utf8"));
  console.log(`Backup de ${conteudo.gerado_em}\n`);

  const alvos = somenteCollection ? [somenteCollection] : COLLECTIONS;

  for (const collectionId of alvos) {
    const docs = conteudo.collections[collectionId] || [];
    if (docs.length === 0) continue;

    // Restauração é aditiva: o que ainda existe é preservado como está.
    const existentes = new Set(
      (await listAllDocuments(collectionId).catch(() => [])).map((d) => d.$id)
    );

    const faltantes = docs.filter((d) => !existentes.has(d.id));
    console.log(`  ${collectionId}: ${faltantes.length} a restaurar (${existentes.size} já presentes)`);

    if (faltantes.length === 0) continue;

    const resultado = await pool(faltantes, 20, (doc) =>
      request(`/databases/${DATABASE_ID}/collections/${collectionId}/documents`, "POST", {
        documentId: doc.id,
        data: doc.dados,
        permissions: doc.permissoes
      })
    );

    const ok = resultado.done - resultado.failures.length;
    console.log(`    restaurados ${ok}/${faltantes.length}`);
    if (resultado.failures.length) console.warn("    falhas:", resultado.failures.slice(0, 3));
  }

  console.log("\n=== RESTAURAÇÃO CONCLUÍDA ===");
}

async function main() {
  const arquivoRestauracao = argumento("--restaurar");

  if (arquivoRestauracao) {
    console.log("=== RESTAURAÇÃO (aditiva — nada é apagado) ===\n");
    await restaurar(arquivoRestauracao, argumento("--collection"));
    return;
  }

  const carimbo = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const destino = resolve(argumento("--saida", "./backups"));

  console.log(`=== BACKUP DO BANCO ===\n`);
  await fazerBackup(destino, carimbo);
}

main().catch((err) => {
  console.error("\n[FALHA]", err.message);
  process.exit(1);
});
