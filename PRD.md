# PRD — Entrega de Kits CHIPOWER

## Objetivo

Aplicativo desktop Windows para a Aline operar a entrega de kits por RFID, com uma tela operacional no notebook e um telão para o participante.

## Escopo do MVP

- Operação offline, com uma base SQLite local da instalação.
- Importação de `.xlsx` com as colunas `NUM`, `CHIP`, `Inscrito`, `CPF`, `Data de Nascimento`, `SEXO`, `Camisa`, `Modalidade` e `Categoria`.
- Preservação de `CHIP` como texto, inclusive zeros à esquerda, e relatório de linhas inválidas/duplicadas.
- Uma fila de leituras: o operador confirma a entrega; a confirmação e o EPC são auditados.
- Telão com nome, número, chip, camisa, modalidade, categoria e estado. CPF e data de nascimento nunca são enviados ao telão.
- Fundo configurável para a instalação, copiado para a pasta local do aplicativo, e identidade visual CHIPOWER com as duas logos fornecidas.
- Leitor real Impinj Speedway R420 via OctaneSDK 5.2.0, IP inicial `192.168.0.33`, antenas 1–4, mais simulador para demonstração sem hardware.

## Decisões assumidas

- Não haverá Wiclax, sincronização em Android ou backup Android neste MVP.
- O MVP usa uma única base local, `%LocalAppData%\Chipower\EntregaDeKits\eventos.db`. A importação, após confirmação explícita do operador, substitui a lista e apaga as auditorias anteriores; não há gerenciamento de múltiplos eventos nesta versão.
- O R420 permite somente um cliente LLRP: o ShipRed deve estar completamente fechado antes de conectar este aplicativo.
- A correlação EPC ↔ CHIP não recebe regra inventada. São aceitos apenas: EPC normalizado exatamente igual ao CHIP; EPC hexadecimal completo (24 caracteres) convertido para decimal; e EPC hexadecimal ASCII que resulte em identificador limpo. Em todos os casos a correspondência precisa ser única.
- Exemplo de conversão: `00000000000000000000CAD1` convertido de hexadecimal resulta em `51921`. O MVP usa a conversão matemática padrão; a amostra real do evento continua obrigatória.

## Distribuição para o cliente

- A entrega principal deve ser um executável Windows autossuficiente, com nome explícito e pronto para abrir com dois cliques.
- O cliente não deve precisar localizar DLLs, executar comandos, instalar o .NET ou navegar por uma estrutura técnica.
- ZIP com arquivos internos pode existir somente como alternativa de suporte; o link e o e-mail destinados ao cliente devem destacar o executável direto.
- Toda nova publicação deve passar por smoke test do executável isolado em pasta limpa antes do envio.

## Direção de interface

- A janela operacional segue a direção “central industrial refinada”, com identidade CHIPOWER preta/laranja e hierarquia orientada ao trabalho em evento.
- Leitura atual, participante, confirmação e fila são o foco principal; importação, telão e configuração do R420 permanecem em uma área auxiliar claramente separada.
- O layout deve funcionar sem rolagem horizontal e preservar acesso às ações em 1280×720, 1366×768 e 1920×1080, incluindo escalas de 100%, 125% e 150%; quando necessário, usa somente rolagem vertical.
- O telão usa composição proporcional, alto contraste sobre a foto do evento e nunca exibe CPF ou data de nascimento.

## Critérios de aceite

1. O Excel atual pode ser importado, gerando totais, ausências e duplicidades no relatório.
2. Uma leitura simulada ou real localiza exclusivamente um inscrito, entra na fila e atualiza o telão.
3. Confirmar a entrega grava data/hora, EPC e operador na auditoria; nova leitura informa `KIT JÁ ENTREGUE` com horário.
4. O telão não mostra CPF nem data de nascimento, mantém legibilidade sobre foto e funciona no monitor principal se não houver segundo monitor.
5. O projeto passa por `dotnet restore`, `dotnet build -c Release` e `dotnet test -c Release`.
6. Antes de substituir a planilha, o operador recebe aviso de que lista e entregas anteriores serão apagadas; a fila pendente é descartada somente após a substituição concluída.
7. O executável autossuficiente abre em pasta limpa sem instalação do .NET e apresenta a janela principal do sistema.
8. A janela operacional mantém hierarquia e acesso às ações nas resoluções previstas, e o telão preserva a composição em 16:9 e 4:3.

## Riscos e gate de homologação física

- Esta versão **não está homologada para evento oficial**. A rede, IP, potência/posicionamento das antenas, exclusividade LLRP e encerramento seguro devem ser verificados na maleta real.
- Uma amostra real de EPC e CHIP é o gate obrigatório para validar o vínculo RFID; até lá, uma leitura fora das três formas seguras será corretamente recusada como não localizada/ambígua.
- A homologação deve confirmar: ShipRed fechado, R420 acessível em `192.168.0.33`, leitura nas antenas 1–4, reconexão após perda de rede, confirmação persistida após reinício e visibilidade no telão.
