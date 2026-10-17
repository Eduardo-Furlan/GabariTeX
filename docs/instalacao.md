---
title: Instalação do GabariTeX
---

# Instalação do GabariTeX

Com este guia, você aprenderá a instalar o GabariTeX no Windows e Linux ou a adicionar a versão web como aplicativo independente no seu dispositivo.

## Antes de começar

- Verifique qual é o sistema operacional do seu computador (Windows 10/11 ou distribuição Linux de 64 bits).
- Acesse a página oficial de lançamentos no GitHub (`https://github.com/Eduardo-Furlan/GabariTeX/releases/latest`) para baixar os instaladores.
- Se você optar por usar a versão web, utilize um navegador moderno como Google Chrome, Edge ou Brave.

## Passo a passo

1. Acesse a página de lançamentos do projeto no GitHub e baixe o instalador adequado ao seu sistema (`.exe` ou `.msi` para Windows; `.deb`, `.rpm` ou `.AppImage` para Linux).

2. No Windows, dê um duplo clique no instalador baixado; quando o aviso de fornecedor não reconhecido for exibido pelo sistema, clique em `Mais informações`.
   <Screenshot id="instalacao-01-smartscreen" />

3. Em seguida, confirme a inicialização clicando no botão `Executar assim mesmo` para concluir a instalação normalmente.
   <Screenshot id="instalacao-02-executar" />

4. No Linux, instale o pacote correspondente à sua distribuição (por exemplo, execute `sudo dpkg -i gabaritex_*.deb` no Debian/Ubuntu, ou `sudo rpm -i gabaritex-*.rpm` no Fedora) ou torne o `.AppImage` executável com o comando `chmod +x GabariTeX*.AppImage` e abra-o com dois cliques.

5. Na versão web, para criar um atalho direto na área de trabalho e usar o programa sem abrir o navegador, clique no botão **Perfil** no canto superior direito e selecione a opção **Instalar Aplicativo**.
   <Screenshot id="instalacao-03-web-pwa" />

## Dicas

::: tip Por que o Windows exibe o aviso do SmartScreen?
O GabariTeX é um projeto de código aberto mantido pela comunidade educacional e não adquire certificados comerciais pagos da Microsoft. O aviso do SmartScreen é o comportamento padrão do Windows para executáveis novos de código aberto e não significa que o arquivo seja malicioso.
:::

::: tip Atualizações automáticas na web
A versão web do GabariTeX utiliza tecnologia de aplicativo progressivo. Quando uma nova versão é publicada, o sistema carrega os arquivos em segundo plano e exibe um aviso sugerindo recarregar a página para receber as melhorias.
:::

## Se algo não funcionar

- *O instalador do Windows foi impedido pelo antivírus:* abra a central de segurança do Windows e confirme a autorização para o arquivo baixado diretamente do repositório oficial no GitHub.
- *O arquivo .AppImage não inicia no Linux:* em distribuições mais recentes do Ubuntu, instale o pacote `libfuse2` pelo terminal (`sudo apt install libfuse2`) para habilitar o suporte ao formato AppImage.
- *O botão de instalação web não aparece:* janelas de navegação anônima desabilitam a instalação de aplicativos locais. Acesse o GabariTeX em uma aba comum do navegador.
