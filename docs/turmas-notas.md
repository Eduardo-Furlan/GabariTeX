---
title: Gerenciamento de turmas e livro de notas
---

# Gerenciamento de turmas e livro de notas

Organize alunos por turma, consulte o histórico de notas e exporte relatórios para a coordenação.

## Antes de começar

O cadastro de turmas no GabariTeX é prático e flexível:

- Criar uma turma é opcional para fazer uma correção rápida avulsa, mas é altamente recomendado para registrar o histórico, associar notas aos nomes dos estudantes e emitir boletins organizados.
- Você pode digitar o nome dos alunos um a um ou colar a lista completa fornecida pela secretaria da escola.
- As turmas e notas ficam salvas no armazenamento local do seu perfil no GabariTeX.

## Passo a passo

### 1. Criar turmas e organizar estudantes

Na barra superior, clique em **Turmas** para abrir o gerenciador dividido em lista de turmas à esquerda e estudantes à direita.

<Screenshot id="turmas-notas-01-lista-turmas" />

Para adicionar uma nova classe, clique em **Nova**, digite a identificação (por exemplo, `2º A` ou `9º Ano Tarde`) e confirme em **Salvar**. A nova turma passa a compor sua lista lateral.

### 2. Cadastrar e importar estudantes

Com a turma selecionada na coluna esquerda, adicione os nomes no painel principal:

- *Digitação individual:* Utilize os campos da barra inferior para informar o nome e a matrícula do estudante e clique em **Adicionar Aluno**.
- *Importação em bloco:* Clique em **Importar / Colar**, cole uma lista com nomes copiados do diário escolar ou selecione um arquivo de texto e confirme a importação.

### 3. Definir a turma ativa antes da correção

Antes de escanear os gabaritos no corretor, clique em **Definir como Turma Ativa** no topo do painel da turma. Assim, todas as notas lidas pelo aplicativo serão vinculadas de forma automática aos alunos daquela classe.

### 4. Consultar o livro de notas

Acesse a aba **Notas** para visualizar a tabela geral de notas calculadas com a pontuação e percentual de cada estudante.

<Screenshot id="turmas-notas-02-livro-notas" />

A tabela apresenta o nome do estudante, versão da folha realizada, acertos e nota final. Você pode usar o filtro de turma para isolar uma sala específica, abrir detalhes de qualquer prova para inspecionar marcações e até ajustar pontuações de questões dissertativas.

Se houver alteração de gabarito ou anulação posterior de alguma questão, use o botão **Recalcular** para atualizar todas as notas da prova de uma única vez.

### 5. Exportar relatórios em planilha

Na tabela de notas, clique em **Exportar para Excel / CSV** para baixar a planilha consolidada com todas as notas da turma. O arquivo inclui nome, matrícula, versão, total de acertos e nota final, pronto para lançamento nos sistemas acadêmicos da escola.

### 6. Analisar o desempenho pedagógico por item

Clique no botão **Análise por Questão** para verificar as taxas de acerto e o comportamento da turma em cada item da prova.

<Screenshot id="turmas-notas-03-analise-itens" />

O painel reúne indicadores essenciais como média da turma, mediana, maior e menor nota, além de uma tabela detalhada com o índice de acerto de cada questão e a distribuição das alternativas assinaladas. Isso permite identificar rapidamente conteúdos que necessitam de retomada pedagógica.

### 7. Emitir espelhos individuais de correção

Clique em **Imprimir Espelhos (A4)** para gerar comprovantes individuais de correção para entrega aos estudantes.

<Screenshot id="turmas-notas-04-comprovante-aluno" />

O GabariTeX formata filipetas individuais prontas para corte ou impressão, apresentando o cabeçalho da avaliação, nota alcançada e o espelho de cada resposta comparada ao gabarito oficial.

## Dicas para o dia a dia

- *Cadastro de matrícula ou chamada:* Inclua o número de chamada ou RA para evitar confusões com nomes semelhantes na mesma turma.
- *Aluno ausente da lista:* Se um estudante fizer a prova sem cadastro prévio, você pode digitar o nome dele diretamente na janela de correção; o GabariTeX permite adicioná-lo à turma na mesma hora.
- *Filtro de faltantes:* Na barra da turma ativa, utilize a opção para conferir quais alunos da turma ainda não tiveram folha corrigida.
- *Correção de notas antigas:* Caso identifique um erro de correção, expanda a linha do estudante no livro de notas e clique na alternativa desejada para atualizar a pontuação instantaneamente.

## Se algo não funcionar

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| *Nota associada à turma incorreta* | A turma ativa selecionada no corretor não correspondia à sala dos alunos corrigidos. | No livro de notas, abra a linha do estudante e altere a turma de destino ou defina a turma correta antes do lote. |
| *Estudante duplicado na lista* | O nome foi importado duas vezes com grafias ligeiramente diferentes. | No gerenciador de turmas, use o ícone de lixeira para remover a entrada duplicada sem afetar as notas registradas. |
| *Arquivo CSV com caracteres estranhos no Excel* | Codificação padrão de texto UTF-8 ao abrir diretamente com duplo clique. | No Excel, importe o arquivo via aba *Dados* selecionando a codificação UTF-8 ou abra diretamente no Google Planilhas. |
| *Planilha exportada vazia* | O filtro de turma selecionado na tela de notas não possui registros corrigidos. | Alterne o seletor de turmas para *Todas as turmas* ou selecione a avaliação correta no filtro superior. |
