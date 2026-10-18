---
title: Problemas comuns e como resolver
---

# Problemas comuns e como resolver

Encontre soluções rápidas para dúvidas frequentes de impressão, conexão e correção no GabariTeX.

## Índice de problemas

- [A folha de respostas não cabe em uma página](#a-folha-de-respostas-nao-cabe-em-uma-pagina)
- [A câmera não reconhece a folha de jeito nenhum](#a-camera-nao-reconhece-a-folha-de-jeito-nenhum)
- [Falha ao decodificar gabarito ou senha incorreta](#falha-ao-decodificar-gabarito-ou-senha-incorreta)
- [O celular não conecta na câmera sem fio](#o-celular-nao-conecta-na-camera-sem-fio)
- [Respostas ambíguas ou rasuras detectadas](#respostas-ambiguas-ou-rasuras-detectadas)
- [No Linux, o arquivo AppImage não abre](#no-linux-o-arquivo-appimage-nao-abre)
- [No Windows, o sistema exibe aviso do SmartScreen](#no-windows-o-sistema-exibe-aviso-do-smartscreen)
- [Estou na versão Web e o Corretor pede para baixar o aplicativo Desktop](#estou-na-versao-web-e-o-corretor-pede-para-baixar-o-aplicativo-desktop)

---

## A folha de respostas não cabe em uma página

### Mensagem exibida
> `A folha de respostas não cabe em uma página. Reduza o texto do cabeçalho ou o número de questões.`

### Causa
O cartão-resposta foi desenvolvido para caber estritamente em uma única página A4, garantindo economia de papel e leitura óptica precisa. Se o cabeçalho possuir muitas linhas de instruções, se houver imagens grandes ou se a avaliação ultrapassar 40 questões, o layout ultrapassa o limite vertical.

### O que fazer
1. Na tela de criação da prova, acerte o cabeçalho para conter apenas as informações essenciais (escola, disciplina, professor e orientações breves).
2. Verifique o limite máximo suportado: o GabariTeX organiza até 40 questões em diagramação de duas colunas no cartão de respostas.
3. Alterne para a pré-visualização na Central de Impressão e confirme se o aviso em vermelho desapareceu.

---

## A câmera não reconhece a folha de jeito nenhum

### Mensagens exibidas
> `Fiduciais candidatos insuficientes: X encontrados (mínimo 4).`
> `Fiduciais não formam uma folha válida (área insuficiente ou geometria inválida).`

### Causa
O motor de visão computacional busca os quatro marcadores pretos quadrados nos cantos da folha para corrigir a perspectiva da foto. Se um dos cantos for cortado, se houver sombra pesada sobre ele ou se a folha estiver amassada, a detecção falha.

### O que fazer
1. *Afaste ligeiramente a câmera:* Garanta que toda a borda da folha e os quatro cantos pretos apareçam na imagem com folga.
2. *Melhore a iluminação:* Fotografe em um ambiente bem iluminado. Evite que a sombra do próprio celular ou da sua mão cubra os marcadores ou as alternativas.
3. *Superfície plana:* Mantenha a folha apoiada sobre uma mesa reta, sem dobras ou ondulações.
4. *Ângulo reto:* Posicione o aparelho paralelo à folha, apontando a lente de cima para baixo.

---

## Falha ao decodificar gabarito ou senha incorreta

### Mensagens exibidas
> `Falha ao decodificar gabarito: verifique se a senha informada está correta.`
> `Não foi possível ler o QR Code da folha de respostas.`

### Causa
As respostas corretas de cada versão são armazenadas com criptografia dentro do código QR impresso no topo da folha. Para que o aplicativo decodifique o gabarito, a senha utilizada na criação da prova deve estar presente no corretor.

### O que fazer
1. Digite a senha da avaliação no campo `Senha da Prova (QR Code)` no painel superior do corretor.
2. No modo de foto individual, aproxime a câmera do código QR no topo da folha para realizar a leitura de identificação inicial antes de ler as bolinhas.
3. Se você não se lembrar da senha, selecione diretamente a letra da versão (por exemplo, `A` ou `B`) na barra superior do corretor para travar o gabarito correspondente.

---

## O celular não conecta na câmera sem fio

### Sintomas
- A página no celular exibe aviso de desconexão ou tempo limite esgotado.
- O navegador do celular não consegue carregar o endereço gerado pelo computador.

### Causa
O computador e o telefone precisam estar na mesma rede local Wi-Fi. Muitas redes corporativas ou escolares bloqueiam a comunicação direta entre dispositivos (isolamento de clientes) ou possuem regras de firewall restritivas.

### O que fazer
1. *Verifique o Wi-Fi:* Certifique-se de que celular e computador estão na mesma rede sem fio.
2. *Use o roteador do próprio celular (Hotspot):* Ative o recurso de roteador Wi-Fi pessoal no smartphone e conecte o computador nele. Esta é a solução mais estável e rápida para escolas com redes públicas restritas.
3. *Troca de endereço IP:* No painel **Câmera do Celular**, caso seu computador possua mais de uma interface de rede, selecione o IP correto no menu seletor de endereço.
4. *Liberação no firewall:* Se o sistema operacional bloquear a porta, libere a porta `47831/tcp` no firewall do computador:
   - Ubuntu / Debian: `sudo ufw allow 47831/tcp`
   - Fedora: `sudo firewall-cmd --add-port=47831/tcp`
5. *Tempo limite de 30 minutos:* A sessão sem fio é encerrada automaticamente após 30 minutos de inatividade. Clique novamente em **Câmera do Celular** no computador para gerar um novo código de conexão.

---

## Respostas ambíguas ou rasuras detectadas

### Mensagem exibida
> `Respostas ambíguas detectadas: revise a marcação manual.`

### Causa
O estudante assinalou mais de uma alternativa, deixou a bolinha marcada muito fraca ou utilizou corretivo/rasura que deixou resíduos escuros na folha.

### O que fazer
1. No lote de correção, as folhas nessa situação recebem a sinalização amarela de revisão pendente.
2. Clique no botão de revisão para abrir a janela de conferência manual.
3. O GabariTeX mostra o recorte ampliado da marcação original da prova.
4. Clique na alternativa correta desejada ou marque a questão como rasurada/em branco e confirme em **Salvar Nota no Livro**.

---

## No Linux, o arquivo AppImage não abre

### Sintoma
Ao clicar duas vezes no arquivo `.AppImage`, nada acontece ou o sistema exibe mensagem de erro de execução.

### Causa
Distribuições modernas (como Ubuntu 22.04 em diante) não incluem por padrão a biblioteca `libfuse2`, necessária para rodar pacotes AppImage, ou o arquivo baixado não possui permissão de execução atribuída.

### O que fazer
1. Abra o terminal na pasta onde o arquivo foi baixado e conceda permissão de execução:
   ```bash
   chmod +x GabariTeX-1.0.0.AppImage
   ```
2. Instale a biblioteca de suporte ao FUSE:
   - Ubuntu / Debian / Mint:
     ```bash
     sudo apt update && sudo apt install -y libfuse2
     ```
   - Fedora:
     ```bash
     sudo dnf install fuse-libs
     ```
3. Se preferir não instalar o FUSE, baixe o pacote `.deb` correspondente na página de lançamentos do projeto.

---

## No Windows, o sistema exibe aviso do SmartScreen

### Mensagem exibida
> `O Windows protegeu o computador. O Microsoft Defender SmartScreen impediu a inicialização de um aplicativo não reconhecido.`

### Causa
O instalador do GabariTeX é distribuído de forma independente e não possui certificado comercial pago da Microsoft, o que aciona o aviso preventivo para novos aplicativos baixados da internet.

### O que fazer
1. Na janela azul do aviso, clique no link sublinhado *Mais informações*.
2. Em seguida, clique no botão *Executar assim mesmo*.
3. O instalador do GabariTeX abrirá normalmente e o aviso não será exibido nas próximas inicializações.

---

## Estou na versão Web e o Corretor pede para baixar o aplicativo Desktop

### Contexto
Ao acessar o corretor pela versão web do GabariTeX, o sistema apresenta o painel informativo destacando as vantagens do aplicativo para computador.

### Por que isso acontece?
A criação de provas, formatação em LaTeX e exportação para impressão funcionam integralmente no navegador web. No entanto, a correção de folhas físicas exige processamento de visão computacional intensivo (OpenCV nativo) e abertura de servidor de rede local seguro para parear a câmera do smartphone sem fios.

### O que fazer
1. Clique no botão **Baixar GabariTeX Desktop (GitHub Releases)** no cartão informativo.
2. Baixe o instalador correspondente ao seu sistema operacional (Linux ou Windows).
3. No computador onde o aplicativo foi instalado, importe seu arquivo de perfil para continuar corrigindo suas folhas com total precisão e sem depender de internet.
