# Entrega de Kits CHIPOWER

MVP desktop WPF/.NET 8 para importação local, identificação RFID e apresentação no telão.

## Pré-requisitos e execução

No Windows com .NET SDK 8:

```powershell
dotnet restore
dotnet build -c Release
dotnet test -c Release
dotnet run --project src/EntregaDeKits.App
```

O aplicativo usa uma única base SQLite local em `%LocalAppData%\Chipower\EntregaDeKits\eventos.db`. Use **Importar Excel** e selecione `LISTA INSCRITOS DE POSTO EM POSTO CORRETA.xlsx`. Após a confirmação explícita, a importação substitui a lista e apaga auditorias de entregas anteriores; este MVP não gerencia múltiplos eventos. O relatório mostra linhas importadas, vazias, inválidas e duplicidades. O campo **Simular EPC** permite validar o fluxo sem leitor.

## Operação do R420

- Endereço inicial: `192.168.0.33`; antenas 1, 2, 3 e 4.
- O R420 aceita um único cliente LLRP. Feche totalmente o ShipRed antes de usar **Iniciar R420**; não opere os dois sistemas no leitor ao mesmo tempo.
- O botão **Parar leitor** tenta encerramento ordenado e limita a espera; ele deve ser usado antes de fechar a aplicação ou devolver a maleta.
- O aplicativo não contém Wiclax, comunicação Android nem backup neste MVP.

## Segurança e privacidade

O banco guarda CPF e data de nascimento apenas para o cadastro local importado. Esses dados não são exibidos no telão. Mantenha a pasta do banco sob controle do evento e faça cópia manual somente conforme a política do organizador.

## Roteiro de smoke test

1. Importe o Excel e confira o relatório.
2. Abra o telão e escolha uma foto de fundo, se desejado.
3. Use um CHIP da planilha no campo de simulação; o participante deve aparecer como `AGUARDANDO CONFIRMAÇÃO`.
4. Confirme a entrega e repita a mesma simulação; o telão deve informar `KIT JÁ ENTREGUE` e horário.
5. Na homologação física, feche o ShipRed, conecte ao R420, teste antenas 1–4 e apresente uma amostra EPC/CHIP real antes de qualquer prova oficial.

A foto escolhida é copiada para `%LocalAppData%\Chipower\EntregaDeKits\event-assets`; assim o telão continua disponível mesmo se o arquivo original for movido ou removido. A logo escura é usada sobre o painel grafite e a logo clara é usada quando o telão recebe uma foto de fundo.

## Limitação conhecida

O EPC↔CHIP só aceita correspondência exata, EPC hexadecimal completo convertido para decimal (por exemplo, `00000000000000000000CAD1` → `51921`) ou ASCII hexadecimal limpo. Não há regra por sufixo. A amostra física real é obrigatória para homologação.
