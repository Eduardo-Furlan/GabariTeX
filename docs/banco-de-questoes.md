---
title: Banco de questões e sorteio automático
---

# Banco de questões e sorteio automático

Com este guia, você aprenderá a organizar seu acervo pedagógico em grupos taxonômicos e etiquetas livres, cadastrar questões com suporte completo a LaTeX e imagens, reutilizar itens em avaliações e configurar modelos de prova (*blueprints*) para sorteio combinatório automatizado.

O Banco de Questões do GabariTeX permite centralizar e reaproveitar enunciados com facilidade. Você pode categorizar questões em tópicos hierárquicos, aplicar múltiplas etiquetas de conteúdo ou dificuldade e definir regras estruturadas para sortear cadernos equilibrados com sementes reprodutíveis.

## Antes de começar

- Acesse a barra de navegação superior e clique em **Banco de Questões**.
- Tenha seus enunciados, fórmulas matemáticas e gabaritos organizados para inclusão no acervo.
- Todas as questões, grupos, etiquetas e modelos são gravados localmente no seu dispositivo (banco de dados local na web ou disco rígido no computador).
- O limite máximo para qualquer avaliação gerada ou combinada permanece em 40 questões por prova para garantir total conformidade com a folha de respostas A4 padronizada.

## Passo a passo

### 1. Organizar grupos taxonômicos na árvore

Organize seus conteúdos curriculares em uma árvore hierárquica por disciplinas, módulos e tópicos.

<Screenshot id="banco-01-visao-geral" />

1. Na coluna lateral esquerda do Banco de Questões, visualize a árvore de tópicos e o grupo raiz **Sem Grupo**, que reúne questões ainda não categorizadas.
2. Clique no botão **Novo Grupo** no topo da coluna para criar uma nova pasta temática (por exemplo: *Matemática* ou *Física*).
3. Para criar subgrupos com até 12 níveis de profundidade (por exemplo: *Matemática / Geometria / Plana*), passe o mouse sobre o grupo desejado e use o botão de criação de subgrupo.
4. Cada pasta exibe a contagem agregada de questões disponíveis, somando todos os seus subgrupos descendentes.
5. Para reorganizar a estrutura, você pode arrastar pastas para outro destino ou usar as opções de teclado e menu.
6. Ao excluir uma pasta que contenha questões ou subpastas, o sistema abre uma confirmação segura com duas alternativas: transferir todos os itens para outro grupo antes da exclusão ou remover a pasta e seus descendentes em conjunto.

### 2. Gerenciar etiquetas livres

Aplique marcações transversais para classificar itens por nível de dificuldade, habilidades ou fontes de vestibular.

1. No topo da tela, clique em **Etiquetas** para gerenciar sua lista de marcadores.
2. Cada etiqueta possui um nome único e uma cor visual de destaque (como verde para *Fácil*, âmbar para *Média*, vermelho para *Difícil* e azul para *ENEM*).
3. Na barra de filtros, clique nas etiquetas desejadas para refinar instantaneamente a listagem de questões exibidas.
4. Ao excluir uma etiqueta, ela é desvinculada automaticamente de todas as questões do banco sem apagá-las. Se a etiqueta estiver vinculada a modelos de sorteio salvos, o sistema sinaliza o modelo para revisão.

### 3. Cadastrar e editar questões no acervo

Cadastre itens com enunciados detalhados, gabarito e alternativas de múltipla escolha ou formato dissertativo.

<Screenshot id="banco-02-editor-questao" />

1. Clique em **Nova Questão** para abrir o formulário completo de edição.
2. Selecione o grupo taxonômico no seletor de pastas e atribua uma ou mais etiquetas temáticas.
3. Escolha o tipo de item:
   - *Objetiva:* preencha de 2 a 5 alternativas, digite as opções com equações matemáticas e marque o círculo da resposta correta.
   - *Dissertativa:* defina a quantidade de linhas pautadas reservadas para a resposta do estudante na folha de questões.
4. Digite fórmulas matemáticas entre cifrões (`$x^2 + y^2 = r^2$`) no enunciado para acompanhar a renderização em tempo real via KaTeX.
5. No bloco de anexo de imagem, carregue figuras ou gráficos e preencha a legenda explicativa correspondente.
6. Preencha campos pedagógicos opcionais, como **Pontuação Padrão** da questão, notas didáticas de contexto e resolução passo a passo.
7. Use a opção **Arquivar** em questões antigas que não devam mais aparecer nas listagens habituais nem em novos sorteios, mantendo seu histórico preservado.

### 4. Integrar o acervo com a elaboração de provas

Reaproveite questões prontas do banco durante a montagem de provas manuais ou envie novas questões redigidas para o acervo.

1. *Adicionar do banco para a prova:* no editor de avaliações, clique no botão **Adicionar do Banco** localizado ao lado do botão de importar questões. Selecione as questões desejadas por busca textual ou filtro de etiquetas e confirme a inclusão. O sistema indica itens que já constam na avaliação ("Já na Prova") para evitar duplicidades acidentais.
2. *Salvar da prova para o banco:* se você redigiu uma questão interessante diretamente em uma prova e deseja guardá-la para o futuro, use a ação **Salvar no Banco**. O sistema verifica se o enunciado e as alternativas já existem no banco e impede duplicações não intencionais.

### 5. Configurar modelos de prova e sorteio visual

Crie modelos de avaliação (*blueprints*) compostos por blocos de origem e cotas quantitativas de conteúdo.

<Screenshot id="banco-03-gerador-visual" />

1. Na tela do banco, acesse a aba **Modelos** e clique em **Gerar Prova** (ou selecione um modelo salvo na lista).
2. Na visão **Visual**, cada bloco de sorteio possui uma expressão de origem e uma ou mais linhas de cotas:
   - *Sortear de qualquer um (OU):* combina o conjunto de questões de várias pastas selecionadas.
   - *Garantir ao menos uma de cada (E):* exige representatividade de múltiplos grupos no mesmo bloco.
   - *Usar apenas um, sorteado (XOU):* escolhe aleatoriamente uma das matérias viáveis.
   - *Exceto:* subtrai subgrupos indesejados da busca.
3. Em cada linha de cota, defina a quantidade de questões a sortear, os filtros de etiquetas exigidas ou excluídas e o tipo de item (objetiva ou dissertativa).
4. O GabariTeX calcula em tempo real a quantidade de questões disponíveis no seu acervo para cada linha e emite alertas visuais imediatos caso haja escassez de itens ou disputas conjuntas entre linhas do mesmo bloco.

### 6. Redigir regras no modo texto (DSL formal)

Alterne para o editor de texto quando preferir redigir ou colar regras rapidamente com sintaxe formal.

<Screenshot id="banco-04-gerador-texto" />

1. No topo da tela do gerador, clique na aba **Texto** para exibir o editor monospace integrado.
2. Digite as regras utilizando palavras-chave em português ou inglês (como `DE`, `INCLUIR`, `PONTOS`, `OU`).
3. O editor oferece autocompletar inteligente para nomes de pastas e etiquetas, realce visual de sintaxe e lista de diagnósticos com indicação exata de linha e coluna ao encontrar erros.

### 7. Pré-visualizar o sorteio e gerar a avaliação

Confira as questões sorteadas pelo algoritmo antes de finalizar a prova.

1. Clique no botão **Pré-visualizar Sorteio** para acionar o algoritmo combinatório determinístico.
2. Na lista de questões pré-visualizadas, utilize os recursos de ajuste fino:
   - *Travar questão:* fixe um item aprovado com o ícone de cadeado para que ele não mude ao rodar novos sorteios.
   - *Trocar questão:* substitua individualmente um item sorteado por outra opção válida do mesmo bloco.
   - *Sortear de Novo:* re-sorteia todas as questões destravadas mantendo as regras e travas ativas.
   - *Semente:* código alfanumérico que define a aleatoriedade do sorteio. Informar a mesma semente com as mesmas regras e o mesmo banco gera rigorosamente a mesma prova.
   - *Evitar repetições:* selecione avaliações aplicadas anteriormente para que o sistema descarte questões que os alunos já responderam em bimestres passados.
3. Ao finalizar a seleção, clique em **Criar Prova** para abrir imediatamente o editor com a nova avaliação gerada ou em **Adicionar à Prova Atual** para anexar as questões selecionadas à prova em aberto.

### 8. Compartilhar acervos e subárvores com colegas

Compartilhe seleções de questões com outros professores sem expor seu perfil de provas ou turmas.

1. Na árvore de grupos, passe o mouse sobre o tópico desejado e clique no botão de exportar grupo. O sistema compacta a pasta, seus subgrupos, as questões vinculadas e as imagens em um arquivo `.gabaritex-bank.zip`.
2. Para carregar o pacote em outro computador, abra o Banco de Questões, clique no botão **Importar** na barra de ferramentas e selecione o arquivo.
3. O assistente de importação apresenta o resumo de pastas, questões e etiquetas e permite mesclar o conteúdo preservando identificadores ou integrando os itens sob uma pasta de destino escolhida.

## Referência da linguagem de regras (Modo Texto)

O gerador do GabariTeX possui uma linguagem de consulta formal que pode ser escrita tanto em português quanto em inglês:

| Função | Palavra-chave (PT) | Keyword (EN) | Descrição |
| :--- | :--- | :--- | :--- |
| Origem do bloco | `DE` | `FROM` | Especifica o grupo ou expressão lógica de grupos |
| Inclusão de cotas | `INCLUIR` | `INCLUDE` | Inicia as linhas de cotas a serem sorteadas |
| União | `OU` | `OR` | Sorteia de qualquer um dos grupos informados |
| Cobertura conjunta | `E` | `AND` | Exige pelo menos uma questão de cada grupo |
| Alternativa exclusiva | `XOU` | `XOR` | Sorteia aleatoriamente um dos grupos viáveis |
| Subtração | `EXCETO` | `EXCEPT` | Exclui questões de um grupo específico |
| Sem descendentes | `SOMENTE` | `ONLY` | Considera apenas o grupo direto, sem subgrupos |
| Todo o acervo | `TODAS` | `ALL` | Considera todas as questões do banco |
| Etiqueta obrigatória | `etiqueta("...")` | `tag("...")` | Filtra itens que possuam a etiqueta |
| Etiqueta excluída | `NÃO etiqueta("...")` | `NOT tag("...")` | Exclui itens que possuam a etiqueta |
| Tipo de questão | `tipo("objetiva")` / `tipo("dissertativa")` | `type("objective")` / `type("subjective")` | Filtra pelo formato da questão |
| Pontuação | `PONTOS` | `POINTS` | Atribui pontuação ao bloco ou à cota |

### Exemplos práticos de regras

Regra em português para uma avaliação bimestral de Matemática com três faixas de dificuldade e pontos:

```text
DE Matemática/Álgebra PONTOS 10
  INCLUIR 3 etiqueta("Fácil") tipo("objetiva") PONTOS 1.5,
          2 etiqueta("Média") PONTOS 2.0,
          1 etiqueta("Difícil") tipo("dissertativa") PONTOS 3.5
```

Regra com união de matérias e exclusão de subtópico:

```text
DE (Geometria OU Trigonometria) EXCETO Geometria/Espacial
  INCLUIR 4 etiqueta("Vestibular") tipo("objetiva") PONTOS 2.5
```

Regra equivalente em inglês:

```text
FROM (Geometry OR Trigonometry) EXCEPT Geometry/Spatial
  INCLUDE 4 tag("Vestibular") type("objective") POINTS 2.5
```

### Precedência e resolução de erros

- O operador `EXCETO` possui maior precedência que `OU`, `E` e `XOU`. Quando quiser combinar operadores, utilize parênteses: `(GrupoA OU GrupoB) EXCETO GrupoC`.
- Nomes de grupos com espaços, barras adicionais ou caracteres especiais devem ser colocados entre aspas duplas: `DE "Física Geral/Mecânica"`.
- Caso a quantidade solicitada em uma linha de cota supere o total de questões disponíveis no acervo, o editor exibirá um diagnóstico com indicação de déficit e a geração da prova permanecerá pausada até que a cota seja ajustada ou novas questões sejam cadastradas.

## Dicas

::: tip Sementes idênticas para provas paralelas
A semente alfanumérica registrada na pré-visualização garante que qualquer pessoa com o mesmo banco de questões e o mesmo modelo gere exatamente a mesma sequência de itens. Isso é ideal para sincronizar aplicações de provas entre diferentes unidades escolares ou turnos.
:::

::: tip Organização por etiquetas transversais
Utilize grupos taxonômicos para organizar o conteúdo curricular fixo (como disciplinas e unidades) e utilize etiquetas para metadados dinâmicos (como ano letivo, nível de dificuldade, habilidades da BNCC ou origem do exame).
:::

::: tip Backup integral do acervo
Ao salvar uma cópia de segurança em **Perfil** > **Exportar Perfil (ZIP)**, todo o seu Banco de Questões, pastas taxonômicas, etiquetas e modelos de prova são incluídos automaticamente no arquivo compactado.
:::

## Se algo não funcionar

- *O gerador exibe o aviso de déficit de questões:* verifique se os filtros de etiquetas da linha de cota não são excessivamente restritivos para o grupo escolhido. Altere para a visão **Visual** para consultar a contagem de itens disponíveis ao vivo.
- *O modelo salvo exibe o aviso de grupo removido:* se uma pasta utilizada em uma regra for apagada da árvore taxonômica, o modelo indicará a pendência. Abra o modelo, selecione um novo grupo válido para o bloco e clique em **Salvar**.
- *A mesma semente gerou questões diferentes após editar o banco:* o algoritmo determinístico depende da lista ordenada de questões disponíveis. Se você adicionar, editar o enunciado ou apagar questões do grupo, a sequência do sorteio poderá mudar em relação a sorteios anteriores.
