# Handoff

Projeto: CHIPOWER Entregas / EntregaDeKits. Cliente: Aline.
Product Owner: Yuri. Última atualização: 2026-09-03.

## Fase atual

- **Web (`web/`): Fase B**, em produção e validada pela cliente.
- **Aplicativo desktop (`src/`, WPF .NET 8): Fase B**, aguardando teste físico
  da Aline com a leitora. Nenhuma parte foi homologada para prova oficial.

## O que existe

Duas frentes independentes no mesmo repositório:

1. **Web multi-tenant** (React 19 + Vite + Appwrite self-hosted). Deploy por
   GitHub Actions → VPS. Commits em português.
2. **Aplicativo Windows** (`EntregaDeKits.sln`): balcão de entrega com base
   SQLite local, telão, leitor Impinj R420 e — desde a v0.4.x — as abas
   PASSAGEM e TELÃO para a leitora de mesa HID.

## Fatos confirmados nesta sessão

- A leitora da cliente (CPH-F206) funciona em **modo teclado (HID)**: digita o
  código e envia Enter. Não usa driver, IP nem SDK.
- A captura por cadência foi validada pela cliente na versão web e depois
  replicada no aplicativo com os **mesmos parâmetros**: 60ms entre teclas,
  mínimo de 4 caracteres, janela de repetição de 3s, código em maiúscula.
- O aplicativo tem prova de ponta a ponta levantando eventos reais de teclado
  no WPF: rajada da leitora, EPC de 24 caracteres, Enter atrasado, digitação
  humana e estado desarmado. 54 testes passando.
- O executável publicado abre (janela em ~3s). Versão 0.4.1.
- Planilhas do cliente trazem a coluna CHIP em **decimal curto** (ex.: 51921).

## Riscos abertos

- **Nunca se passou uma etiqueta física no aplicativo.** Só há prova de que o
  teclado é capturado corretamente, não de que o código emitido pela leitora
  corresponde à coluna CHIP da planilha. A tela "POR QUE NÃO ACHEI" existe
  justamente para diagnosticar isso com um print.
- Fechar o aplicativo por sinal automatizado não encerra em 12s. **Comparado
  com a v0.3.3 anterior: comportamento idêntico**, portanto pré-existente e não
  regressão. O fechamento manual pelo X não foi verificado.
- Isolamento entre usuários dentro de um mesmo tenant na web ainda é **apenas
  filtro de interface**. Comprovado por teste que uma sessão de operador lê,
  por API direta, eventos e atletas de outro usuário. A "Opção A" foi escolhida
  pelo Product Owner e não foi implementada.
- Credenciais que já estiveram no histórico do Git precisam de rotação. O
  secret `VPS_PASSWORD` do GitHub ainda não foi criado; o workflow usa um valor
  reserva enquanto isso.
- A instância Appwrite da VPS apresenta exaustão de pool de conexões
  (`Pool 'console' is empty`) e execuções que travam por 30s.

## Regra operacional inegociável

Operação destrutiva em massa só em coleção descartável. Contra dado real,
somente com autorização explícita e item a item do Product Owner. Já houve um
incidente nesta base: 738 registros reais apagados por uma sonda de DELETE em
massa executada sem pedido. Por isso as operações destrutivas vivem hoje só na
Function `admin-api`, com filtro de tenant obrigatório e conferência de
contagem antes e depois.

## Próximo passo

Aguardar o teste físico da Aline com a leitora e a v0.4.1:

1. O código apareceu na tabela de captura?
2. Qual foi o código?
3. Casou com um corredor ou deu "CHIP FORA DA LISTA"?

A resposta 3 decide o passo seguinte. Só depois disso começa a fase 2 do
plano combinado: enviar as leituras ao Wiclax.
