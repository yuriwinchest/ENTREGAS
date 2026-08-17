# Especificação UI/UX — Entrega de Kits CHIPOWER

## Direção visual

**Central de operação industrial refinada.** A interface usa uma base quase preta, placas grafite, laranja CHIPOWER como sinal operacional e tipografia condensada apenas nos títulos. O objetivo não é parecer um dashboard genérico: deve parecer uma estação de entrega pronta para evento, onde a próxima decisão é óbvia mesmo sob pressão.

O elemento memorável é a **faixa laranja de sinal** no painel de leitura. Ela ancora o estado da operação e separa visualmente a pessoa identificada das configurações técnicas.

## Hierarquia da operação

1. Estado da leitura e participante reconhecido.
2. Ação de confirmar entrega e a fila pendente.
3. Importação da lista e controle do telão/evento.
4. Estado e configuração do leitor R420.
5. Avisos técnicos e homologação.

## Estrutura da janela do operador

- Cabeçalho curto: marca, contexto operacional e selo de modo local.
- Coluna principal fluida: painel de participante, confirmação e fila de conferência.
- Coluna auxiliar de largura proporcional: preparação do evento e leitor.
- Ações agrupadas por consequência: ações da entrega não se misturam com manutenção do equipamento.
- Campos e botões mantêm área de clique confortável (mínimo de 40 px físicos na escala padrão).

## Responsividade e DPI

- Grade principal com colunas proporcionais e mínimos reduzidos (`min 430` e `min 280` lógicos) para acomodar 1280×720 em 150% de DPI sem rolagem horizontal.
- Altura usa áreas flexíveis; somente a fila possui rolagem vertical interna.
- A janela pode reduzir para 760×420 lógicos, preservando ações e textos por rolagem vertical. O tamanho inicial é calculado pela área útil real do monitor para respeitar DPI e barra de tarefas.
- Todos os textos críticos têm `TextWrapping`; rótulos longos não deslocam botões ou criam overflow horizontal.
- Cenários de aceite: 1280×720, 1366×768 e 1920×1080 em 100%, 125% e 150% de DPI.

## Telão

- Composição em três zonas: marca discreta, mensagem principal e faixa inferior de contexto.
- Nome é o elemento dominante; dados complementares ficam em linha e quebram quando necessário.
- Painéis translúcidos garantem contraste sobre a foto do evento.
- Em 16:9 e 4:3, as margens e fontes são proporcionais; a área central permanece íntegra.
- Não são exibidos CPF ou data de nascimento.
- O operador pode encerrar o telão pelo botão visível `Fechar telão` ou pela tecla `Esc`.

## Identidade no Windows

- O executável, a janela, a barra de tarefas e o instalador usam o cronômetro recortado da logo CHIPOWER como ícone reconhecível em tamanhos pequenos.
- A janela abre centralizada, dimensionada para a área útil e com renderização WPF compatível, sem exigir maximização para exibir o conteúdo.

## Acessibilidade e operação

- Laranja não é o único sinal: textos de estado e contraste confirmam a ação.
- Contraste alto e capitalização curta em rótulos técnicos.
- Foco visual preservado nos controles nativos do Windows.
- O tratamento altera apenas XAML/recursos visuais. Bindings, nomes dos controles, eventos e fluxo RFID/SQLite/Excel permanecem inalterados.
