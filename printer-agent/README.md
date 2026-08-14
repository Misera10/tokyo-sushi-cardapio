# Tokyo Print

Agente Windows da Tokyo Sushi para impressão local de comandas.

## Versão 0.4.1

Cada alteração funcional ou visual deve gerar uma nova versão. A versão atual é registrada
no aplicativo, no agente local, no projeto e no nome do instalador.

- o histórico local guarda somente as impressões feitas no dia atual;
- trabalhos de dias anteriores são removidos ao abrir o agente, antes de uma nova ação e automaticamente à meia-noite;
- a fila mostra o resumo do dia e mantém a reimpressão disponível apenas até a virada;
- o aplicativo impede duas instâncias simultâneas, evitando conflito na porta local `4242`;
- a tela foi reorganizada para destacar impressora ativa, quantidade do dia, falhas e teste rápido.

## O que está funcionando

- interface WPF com a identidade visual do painel;
- descoberta das impressoras instaladas no Windows;
- seleção automática da impressora marcada como padrão no Windows;
- seleção da impressora ativa;
- comanda de teste em 58 mm ou 80 mm;
- comanda real com itens, adicionais, cliente, pagamento, observações e total;
- fila local persistente com status e tentativa de reimpressão;
- servidor local em `http://127.0.0.1:4242`;
- endpoint de saúde sem autenticação e endpoints operacionais protegidos por origem permitida;
- compatibilidade inicial com qualquer impressora reconhecida pelo spooler do Windows.
- configurações locais de tamanho da fonte e margens independentes para todos os lados;
- versão do agente exibida no painel e no endpoint de saúde.

## Endpoints locais

```text
GET  /health
GET  /printers                 Origin: https://tokyosushi.estudiofernandes.com.br
POST /v1/print-test            Origin: https://tokyosushi.estudiofernandes.com.br
GET  /v1/jobs                  Origin: https://tokyosushi.estudiofernandes.com.br
POST /v1/print-order           Origin: https://tokyosushi.estudiofernandes.com.br
POST /v1/jobs/{id}/retry       Origin: https://tokyosushi.estudiofernandes.com.br
```

O agente aceita requisições apenas em loopback e limita CORS às origens do Tokyo
Sushi. O Admin e o agente precisam estar abertos no mesmo notebook; a origem
permitida é a barreira de acesso. A chave local continua aceita apenas para
compatibilidade com versões antigas do Admin.

## Publicação local

```powershell
dotnet publish TokyoSushi.PrintAgent.csproj `
  --configuration Release `
  --runtime win-x64 `
  --self-contained true `
  -p:PublishSingleFile=true `
  -p:IncludeNativeLibrariesForSelfExtract=true `
  --output publish
```

A integração do Admin, fila diária persistente de pedidos, inicialização com o Windows,
inicialização minimizada e instalador estão incluídos nesta versão. O instalador
fica em `installer/output/TokyoPrintSetup-v0.4.1.exe` e preserva as configurações e a
fila do dia em `%LOCALAPPDATA%\\TokyoSushi\\PrintAgent` durante a desinstalação.

## Uso no notebook da operação

1. Instale o `TokyoPrintSetup-v0.4.1.exe` no notebook que possui a impressora instalada no Windows.
2. Abra o Tokyo Print, confira a impressora marcada como `Padrão` e faça uma comanda de teste.
3. No Admin Tokyo Sushi, abra `Configurações > Impressão` e clique em `Detectar impressora`.
4. Confirme a impressora encontrada, ative a impressão automática e salve as configurações.

O agente não precisa de uma impressora específica da marca: ele usa as impressoras
instaladas no spooler do Windows e seleciona automaticamente a impressora padrão.
