/**
 * Publica (ou atualiza) a Appwrite Function `admin-api`.
 *
 * Empacota functions/admin-api em tar.gz, sobe o deployment, injeta a API key
 * como variável de ambiente secreta e aguarda o build ficar pronto.
 *
 * Uso:
 *   APPWRITE_API_KEY="standard_..." node tools/infra/deploy_admin_function.mjs
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { ENDPOINT, PROJECT_ID, DATABASE_ID, request } from "../lib/appwrite-admin.mjs";

const FUNCTION_ID = "admin-api";
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ORIGEM = join(RAIZ, "functions", "admin-api");

async function garantirFunction() {
  try {
    await request(`/functions/${FUNCTION_ID}`);
    console.log("  [=] function já existe, será atualizada");
    await request(`/functions/${FUNCTION_ID}`, "PUT", {
      name: "CHIPOWER Admin API",
      runtime: "node-22",
      execute: ["users"],
      timeout: 15,
      logging: true,
      entrypoint: "src/main.js",
      commands: "npm install"
    });
  } catch (err) {
    if (err.status !== 404) throw err;
    await request("/functions", "POST", {
      functionId: FUNCTION_ID,
      name: "CHIPOWER Admin API",
      runtime: "node-22",
      execute: ["users"],
      timeout: 15,
      logging: true,
      entrypoint: "src/main.js",
      commands: "npm install"
    });
    console.log("  [+] function criada");
  }
}

async function definirVariaveis() {
  const desejadas = {
    APPWRITE_API_KEY: process.env.APPWRITE_API_KEY,
    APPWRITE_DATABASE_ID: DATABASE_ID
  };

  const atuais = await request(`/functions/${FUNCTION_ID}/variables`);
  const porNome = new Map(atuais.variables.map((v) => [v.key, v]));

  for (const [key, value] of Object.entries(desejadas)) {
    const existente = porNome.get(key);
    if (existente) {
      await request(`/functions/${FUNCTION_ID}/variables/${existente.$id}`, "PUT", {
        key,
        value,
        secret: key.includes("KEY")
      });
      console.log(`  [=] variável ${key} atualizada`);
    } else {
      await request(`/functions/${FUNCTION_ID}/variables`, "POST", {
        variableId: key.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 36),
        key,
        value,
        secret: key.includes("KEY")
      });
      console.log(`  [+] variável ${key} criada`);
    }
  }
}

function empacotar() {
  const dir = mkdtempSync(join(tmpdir(), "chipower-fn-"));
  const arquivo = join(dir, "code.tar.gz");
  // --force-local: no Windows o tar interpreta "C:\..." como host remoto sem isso.
  execFileSync("tar", ["--force-local", "--format=gnu", "-czf", arquivo, "-C", ORIGEM, "."], {
    stdio: "inherit"
  });
  return { dir, arquivo };
}

async function enviarDeployment(arquivo) {
  const form = new FormData();
  form.append("code", new Blob([readFileSync(arquivo)]), "code.tar.gz");
  form.append("activate", "true");
  form.append("entrypoint", "src/main.js");
  form.append("commands", "npm install");

  const res = await fetch(`${ENDPOINT}/functions/${FUNCTION_ID}/deployments`, {
    method: "POST",
    headers: {
      "X-Appwrite-Project": PROJECT_ID,
      "X-Appwrite-Key": process.env.APPWRITE_API_KEY
    },
    body: form
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Falha no upload: ${data.message || res.statusText}`);
  return data;
}

async function aguardarBuild(deploymentId) {
  const limite = Date.now() + 240000;

  while (Date.now() < limite) {
    const dep = await request(`/functions/${FUNCTION_ID}/deployments/${deploymentId}`);
    if (dep.status === "ready") return dep;
    if (dep.status === "failed") {
      console.error(dep.buildLogs?.slice(-2500));
      throw new Error("Build da function falhou.");
    }
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, 4000));
  }

  throw new Error("Timeout aguardando o build da function.");
}

async function main() {
  console.log("=== DEPLOY DA FUNCTION admin-api ===\n");

  await garantirFunction();
  await definirVariaveis();

  const { dir, arquivo } = empacotar();
  try {
    const dep = await enviarDeployment(arquivo);
    console.log(`  [+] deployment ${dep.$id} enviado, aguardando build`);
    await aguardarBuild(dep.$id);
    console.log("\n  [+] build concluído e ativado");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  console.log(`\n=== OK === Function ${FUNCTION_ID} publicada.`);
}

main().catch((err) => {
  console.error("\n[FALHA]", err.message);
  process.exit(1);
});
