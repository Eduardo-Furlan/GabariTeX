---
title: Câmera do celular como leitor
---

# Câmera do celular como leitor

Transforme seu celular em uma câmera sem fio para escanear folhas sem cabos.

## Antes de começar

Para utilizar seu celular como câmera de leitura das folhas de resposta:

- O computador com o GabariTeX e o celular devem estar conectados à mesma rede Wi-Fi local.
- O aplicativo para computador deve estar aberto na tela do corretor.
- Não é necessário instalar nenhum aplicativo no celular: a captura funciona diretamente pelo navegador padrão do aparelho.
- Caso a rede escolar possua restrições entre dispositivos, você pode ativar o roteador Wi-Fi (hotspot) do próprio smartphone e conectar o computador a ele.

## Passo a passo

### 1. Abrir a conexão sem fio no computador

No computador, abra o corretor e clique em **Câmera do Celular** para exibir o código QR e o endereço de pareamento da rede local.

<Screenshot id="camera-celular-01-painel-desktop" />

O painel **Usar Câmera do Celular** é aberto, iniciando um servidor local temporário e seguro na porta `47831`. Um código QR exclusivo da sessão é exibido na tela junto com o endereço de rede correspondente.

### 2. Conectar o celular pelo código QR

Aponte a câmera do seu smartphone para a tela do computador e abra a página no navegador do aparelho.

<Screenshot id="camera-celular-02-navegador-mobile" />

O navegador móvel abre a interface leve do GabariTeX. O indicador no topo passa para o estado verde indicando conexão estabelecida com o computador.

### 3. Fotografar folhas de resposta ou código QR

No celular, selecione **2. Gabarito** e toque no botão **Fotografar Gabarito** para capturar a folha de respostas.

<Screenshot id="camera-celular-03-disparo-mobile" />

A câmera nativa do celular se abre para o disparo. Se estiver no modo de foto individual e precisar identificar uma prova antes da folha, você também pode alternar para **1. QR Code** e usar o botão **Fotografar QR Code** para ler a identificação da avaliação.

### 4. Receber e processar no computador

A cada foto enviada pelo celular, a imagem aparece de forma instantânea na fila de processamento do computador.

<Screenshot id="camera-celular-04-recebida-desktop" />

O painel exibe o selo **Celular Conectado** e a contagem de fotos recebidas. No modo **Em Lote**, cada foto enviada entra automaticamente na fila de análise para correção e cálculo das notas dos estudantes.

## Dicas para o dia a dia

- *Limite de inatividade (30 minutos):* Por segurança e economia de bateria, o servidor encerra a conexão automaticamente após 30 minutos sem envio de fotos. Se a conexão cair, clique novamente em **Câmera do Celular** para reabrir.
- *Uso do roteador do celular:* Em escolas com redes públicas restritas ou com sinal instável, ative os dados móveis e o roteador pessoal do celular, conectando o computador na rede criada pelo telefone.
- *Posição das fotos:* Mantenha o celular na horizontal ou vertical, paralelo à mesa, cobrindo toda a extensão da folha com boa iluminação ambiente.
- *Uso da galeria:* Caso já tenha tirado as fotos antes, você pode usar a opção de envio da galeria diretamente na página do celular para transferir múltiplas imagens para o computador.

## Se algo não funcionar

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| *Celular não abre o endereço ou dá tempo esgotado* | Os dois aparelhos estão em redes diferentes ou a rede possui isolamento de clientes. | Verifique se ambos estão no mesmo Wi-Fi. Se o problema persistir, ative o roteador pessoal do celular e conecte o computador nele. |
| *Câmera não abre no navegador móvel* | O navegador do celular não tem permissão concedida para acessar a câmera. | Nas configurações do navegador do celular, conceda permissão de acesso à câmera para a página. |
| *Conexão interrompida após intervalo de tempo* | A sessão atingiu o tempo limite de 30 minutos de inatividade. | No computador, abra novamente a janela de pareamento e aponte a câmera para o novo código QR gerado. |
| *Bloqueio de firewall no computador* | O sistema operacional está bloqueando conexões na porta de rede local. | Libere a porta `47831/tcp` no firewall do computador ou autorize o GabariTeX nas opções de rede privada. |
