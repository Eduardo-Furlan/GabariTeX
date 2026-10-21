---
title: Criação e edição de provas
---

# Criação e edição de provas

Com este guia, você aprenderá a configurar o cabeçalho da avaliação, adicionar questões de múltipla escolha e dissertativas, inserir fórmulas em LaTeX, incluir imagens com legendas e gerar versões randomizadas.

## Antes de começar

- Abra a **Biblioteca de Provas** e clique em **Nova Prova**.
- Tenha os enunciados das questões, imagens e gabaritos organizados para inclusão.
- Lembre-se de que a folha de respostas A4 padronizada comporta no máximo 40 questões por avaliação.

## Passo a passo

1. Preencha as informações da sua instituição no painel **Cabeçalho & Configurações da Prova** e configure as opções de embaralhamento.
   <Screenshot id="criar-prova-01-cabecalho" />

2. Preencha os campos de identificação: **Instituição / Universidade**, **Disciplina**, **Título da Avaliação**, **Professor(a)**, **Data** e **Instruções Gerais para os Alunos**.

3. No campo **Senha da Prova (QR Code)**, mantenha a senha gerada automaticamente ou digite uma senha própria de 8 caracteres. Essa senha protege o gabarito oficial embutido no código QR de cada folha.

4. Defina a quantidade de provas diferentes no seletor **Qtd. Versões:** e marque as opções **Embaralhar Questões** e **Embaralhar Alternativas** caso deseje cadernos com ordens alternadas para evitar fraudes.

5. Clique em **Nova Objetiva** para adicionar uma questão de múltipla escolha e marque o círculo da resposta correta.
   <Screenshot id="criar-prova-02-questao-objetiva" />

6. Digite expressões matemáticas delimitadas por cifrões no campo **Enunciado da Questão** para acompanhar a visualização imediata.
   <Screenshot id="criar-prova-03-formula-latex" />

7. No bloco de anexo de imagem, carregue uma figura ou gráfico e preencha a legenda correspondente.
   <Screenshot id="criar-prova-04-upload-imagem" />

8. Clique em **Nova Dissertativa** para inserir uma questão discursiva e ajuste o campo **Linhas pautadas para resposta:**.
   <Screenshot id="criar-prova-05-questao-dissertativa" />

## Dicas

::: tip Inserção de fórmulas matemáticas
Para fórmulas no meio do texto, envolva o código em cifrões simples: `$f(x) = ax^2 + bx + c$`. Para fórmulas destacadas em bloco, use `\[ ... \]`. Você também pode clicar nos botões da barra de atalhos rápidos de matemática.
:::

::: tip Reutilizar questões de outras provas
Se você já tiver outras provas cadastradas no sistema, clique no botão **Importar de Outra Prova** no topo da lista para copiar enunciados prontos diretamente para a avaliação atual.
:::

::: tip Adicionar questões do Banco de Questões
Para reaproveitar itens do seu acervo taxonômico organizado, clique em **Adicionar do Banco** no topo da lista de questões. Você pode filtrar por grupo ou etiqueta e importar múltiplas questões de uma só vez respeitando o limite da prova.
:::

::: tip Enviar questões da prova para o Banco
Se você redigiu uma questão durante a montagem da avaliação e deseja guardá-la no acervo permanente, use a opção **Salvar no Banco** no topo da lista ou no menu de ações da questão. O sistema avisa caso identifique enunciados duplicados.
:::

::: tip Questões anuladas
Caso uma questão precise ser cancelada após a aplicação da prova, altere o seletor **Situação:** para conceder os pontos a todos os estudantes ou desconsiderar a questão sem necessidade de reimprimir os cadernos.
:::

## Se algo não funcionar

- *O sistema exibe o aviso de limite de 40 questões atingido:* a folha de respostas A4 foi projetada geometricamente para garantir leitura óptica de até 40 itens. Reduza a quantidade de questões para caber no cartão oficial.
- *A senha da prova foi alterada após imprimir as folhas:* folhas impressas com a senha anterior não abrirão no leitor automático caso a senha atual da prova seja modificada. Mantenha a mesma senha usada na impressão.
- *A fórmula matemática exibe uma caixa vermelha de erro:* verifique se todos os cifrões foram fechados corretamente e se os comandos LaTeX (como chaves e barras invertidas) foram digitados sem erros de sintaxe.
