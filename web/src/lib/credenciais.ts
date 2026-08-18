/**
 * Geração e entrega de credenciais de acesso.
 *
 * Um ponto que não dá para contornar: a senha original NÃO pode ser
 * recuperada depois. O Appwrite guarda apenas o hash — é assim que tem que
 * ser, senão qualquer vazamento do banco entregaria as senhas de todo mundo.
 *
 * Então o fluxo é: no momento em que a senha é definida (criação ou
 * redefinição), ela aparece uma vez para o administrador copiar e enviar.
 * Se o operador esquecer, o caminho é gerar uma nova — nunca "ver a antiga".
 */

export const ENDERECO_DO_SISTEMA = "https://entregaschipower.com";

// Sem caracteres que se confundem ao ditar ou digitar: O/0, I/l/1, S/5.
const LETRAS = "ABCDEFGHJKMNPQRTUVWXYZ";
const MINUSCULAS = "abcdefghijkmnpqrtuvwxyz";
const NUMEROS = "23456789";

/** Senha forte, mas legível o bastante para passar por WhatsApp ou telefone. */
export function gerarSenha(): string {
  const valores = new Uint32Array(10);
  crypto.getRandomValues(valores);

  const sortear = (alfabeto: string, i: number) => alfabeto[valores[i] % alfabeto.length];

  const bloco =
    sortear(LETRAS, 0) +
    sortear(MINUSCULAS, 1) +
    sortear(MINUSCULAS, 2) +
    sortear(NUMEROS, 3) +
    sortear(LETRAS, 4) +
    sortear(MINUSCULAS, 5) +
    sortear(NUMEROS, 6) +
    sortear(NUMEROS, 7);

  return `Kits-${bloco}`;
}

export interface Credenciais {
  nome: string;
  email: string;
  senha: string;
}

/** Mensagem pronta para colar no WhatsApp e mandar para o operador. */
export function montarMensagem({ nome, email, senha }: Credenciais): string {
  return [
    `Olá, ${nome}! Seu acesso ao sistema de entrega de kits da CHIPOWER está liberado.`,
    "",
    `Site: ${ENDERECO_DO_SISTEMA}`,
    `E-mail: ${email}`,
    `Senha: ${senha}`,
    "",
    "Guarde esta senha em local seguro. Se esquecer, peça uma nova ao administrador."
  ].join("\n");
}

/**
 * Copia para a área de transferência.
 * Usa a API moderna e cai para o método antigo quando ela não está disponível
 * (navegador antigo do tablet do balcão, por exemplo).
 */
export async function copiar(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    /* cai para o método antigo */
  }

  try {
    const campo = document.createElement("textarea");
    campo.value = texto;
    campo.setAttribute("readonly", "");
    campo.style.position = "fixed";
    campo.style.opacity = "0";
    document.body.appendChild(campo);
    campo.select();

    const deuCerto = document.execCommand("copy");
    document.body.removeChild(campo);
    return deuCerto;
  } catch {
    return false;
  }
}

/** Link do WhatsApp com a mensagem já preenchida. */
export const linkDoWhatsApp = (credenciais: Credenciais) =>
  `https://wa.me/?text=${encodeURIComponent(montarMensagem(credenciais))}`;
