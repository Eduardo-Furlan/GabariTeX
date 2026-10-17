---
title: Primeiros passos no GabariTeX
---

# Primeiros passos no GabariTeX

Com este guia, você conhecerá as áreas centrais do GabariTeX, entenderá como funcionam os perfis e saberá exatamente onde seus dados ficam guardados.

## Antes de começar

- Abra o GabariTeX no navegador ou pelo aplicativo desktop instalado no seu computador.
- Certifique-se de que a janela esteja visível e maximizada para visualizar as barras de navegação.

## Passo a passo

1. Acesse a **Biblioteca de Provas** para ver a lista de todas as avaliações salvas e navegar pelas seções principais.
   <Screenshot id="primeiros-passos-01-biblioteca" />

2. Na barra de navegação superior, localize as três grandes áreas do aplicativo:
   - **Provas**: tela que reúne suas avaliações cadastradas, com opções para criar, duplicar e renomear.
   - **Turmas**: gerenciador onde você cadastra suas classes e a relação nominal de alunos com matrículas.
   - **Corretor**: área de processamento óptico onde você envia fotos de gabaritos e confere os acertos.

3. Ao abrir ou criar uma prova, observe a barra de etapas numeradas que organiza o ciclo da avaliação:
   - **Criar**: editor de cabeçalho, enunciados, fórmulas e alternativas.
   - **Versões**: visualização das provas randomizadas e dos gabaritos oficiais.
   - **Imprimir**: central de diagramação e impressão em papel A4 ou salvamento em PDF.
   - **Corrigir**: leitura das folhas de resposta preenchidas pelos estudantes.
   - **Notas**: planilha com o desempenho individual, análise de itens e espelhos de resposta.

4. Olhe para o lado direito da barra superior e localize a pílula de estado que exibe a mensagem **Salvo**. Ela confirma que qualquer alteração feita nas suas questões ou turmas é gravada instantaneamente no banco de dados local.

5. Clique no botão **Perfil** no canto superior direito para abrir o menu do professor e conferir os dados salvos.
   <Screenshot id="primeiros-passos-02-menu-perfil" />

6. No cabeçalho desse menu, sob o título **Perfil do Professor**, verifique o contador em tempo real com o número de provas, turmas e notas guardadas neste dispositivo.

7. Use as opções **Exportar Perfil (ZIP)** para gerar uma cópia de segurança de todos os seus dados ou **Importar Perfil (ZIP)** para restaurar informações de outro computador.

## Dicas

::: tip O que é um perfil no GabariTeX?
O perfil é o conjunto completo de todas as suas provas, turmas, listas de alunos e histórico de notas. Ele funciona como uma pasta de trabalho pessoal do professor.
:::

::: tip Onde meus dados ficam armazenados?
O código do GabariTeX não faz chamadas a servidores remotos na nuvem. Na versão web, todas as informações são armazenadas no banco de dados local do seu navegador (IndexedDB). No aplicativo desktop, os dados ficam armazenados no seu computador, na pasta de dados do aplicativo e na pasta de documentos pessoais.
:::

## Se algo não funcionar

- *O indicador exibe a mensagem Erro ao salvar:* verifique se o disco do seu computador não está cheio ou se o navegador não atingiu o limite de armazenamento da partição.
- *O menu Perfil não abre ao clicar:* verifique se a janela do aplicativo está em foco ou tente recarregar a interface.
