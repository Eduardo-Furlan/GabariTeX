---
title: Visão geral do GabariTeX
---

# Visão geral do GabariTeX

Com este guia, você conhecerá o funcionamento geral do GabariTeX, saberá escolher entre a versão web e o aplicativo desktop e dará os primeiros passos para criar e corrigir suas provas.

O GabariTeX é um gerador de provas com suporte a equações em LaTeX que diagramação folhas de questões e cartões de resposta padronizados em tamanho A4. O sistema cria versões com questões e alternativas embaralhadas, gerando um código QR criptografado que guarda o gabarito oficial em cada folha sem depender de banco de dados centralizado. Na etapa de correção, o aplicativo lê as fotos dos cartões preenchidos pelos estudantes e calcula a nota imediatamente.

Para começar agora mesmo, escolha um dos caminhos:

- [Instalar o aplicativo](./instalacao.md): instale a versão para Windows ou Linux no seu computador.
- [Criar uma avaliação](./criar-prova.md): monte o cabeçalho, digite enunciados e adicione fórmulas matemáticas.
- [Corrigir folhas de respostas](./corrigir.md): use o aplicativo desktop para processar fotos e calcular as notas.

::: tip Qual versão devo usar?
A elaboração de provas, diagramação com fórmulas, embaralhamento de versões, gerenciamento de turmas e impressão funcionam tanto no navegador quanto no aplicativo desktop. Já a *leitura do gabarito* por fotos e a conexão sem fio com a câmera do celular exigem o aplicativo desktop (Linux ou Windows), pois utilizam visão computacional nativa.
:::

## Antes de começar

- Escolha se você deseja usar a versão web diretamente no navegador ou instalar o aplicativo oficial no computador.
- Tenha em mãos as questões e o gabarito da avaliação que você pretende elaborar.
- Se for corrigir provas físicas com câmera ou fotos, instale o aplicativo desktop.

## Passo a passo

1. Abra o aplicativo no computador ou acesse a versão web para visualizar a tela inicial com as opções de acesso rápido.
   <Screenshot id="index-01-visao-geral" />

2. Na barra superior, identifique as três áreas principais de trabalho: **Provas** (onde você gerencia suas avaliações), **Turmas** (onde você organiza a lista de estudantes) e **Corretor** (onde as folhas são lidas).

3. Para experimentar o editor imediatamente sem digitar nada, clique no botão **Modelo Matemática** para carregar uma avaliação completa com fórmulas e gráficos.

4. Se preferir começar uma prova em branco, clique no cartão **Criar Prova do Zero** e preencha as informações do cabeçalho da sua instituição.

5. Quando quiser restaurar um perfil de provas e turmas salvo anteriormente, clique em **Importar Perfil** na barra de ferramentas.

## Dicas

::: tip Armazenamento seguro e offline
O GabariTeX não envia suas provas nem os dados dos seus alunos para servidores externos. Todos os arquivos ficam salvos localmente na memória do seu navegador ou no disco rígido do computador.
:::

::: tip Leve seus dados de um aparelho para outro
Você pode elaborar uma prova inteira no computador da escola pela versão web, exportar o arquivo de perfil pelo menu e importá-lo no aplicativo desktop instalado no seu notebook pessoal.
:::

## Se algo não funcionar

- *A tela de correção não abre a câmera na web:* a leitura automática de fotos de cartões de resposta é exclusiva do aplicativo desktop. Acesse a página do corretor na web e clique no botão **Baixar GabariTeX Desktop (GitHub Releases)** para instalar o programa.
- *O navegador perdeu os dados após fechar:* navegadores em modo anônimo ou com limpeza automática de histórico podem apagar os dados locais. Use sempre uma janela de navegação normal e crie backups periódicos pelo menu de exportação.
