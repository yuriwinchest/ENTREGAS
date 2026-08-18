import { account } from "./client";

/**
 * Serviços de autenticação.
 *
 * O provisionamento de contas NÃO acontece aqui: criar usuário é operação
 * privilegiada e vive na Function `admin-api` (ver `lib/adminApi.ts`).
 */
export const auth = {
  async getCurrentUser() {
    try {
      return await account.get();
    } catch {
      return null;
    }
  },

  async login(email: string, pass: string) {
    try {
      await account.deleteSession("current");
    } catch {
      /* sem sessão anterior — segue o fluxo normalmente */
    }

    return account.createEmailPasswordSession(email, pass);
  },

  async logout() {
    try {
      await account.deleteSession("current");
    } catch (err) {
      console.warn("Aviso ao encerrar sessão:", err);
    }
  },

  /** Token de curta duração usado para provar a identidade para a Function. */
  async createJWT(): Promise<string> {
    const res = await account.createJWT();
    return res.jwt;
  }
};
