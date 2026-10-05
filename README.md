# GabariTeX: Gerador e Corretor Óptico de Provas com LaTeX

> **Produto Pedagógico Universitário** desenvolvido com auxílio do **Google Antigravity**.

Aplicação web estática (SPA) moderna em React, TypeScript e Tailwind CSS, projetada para a elaboração, randomização de versões, diagramação em papel A4 e correção automática por leitura óptica (OMR) em tempo real via câmera de smartphone ou webcam.

Focada primordialmente em avaliações de **Matemática e Ciências Exatas** através de renderização nativa de equações em LaTeX (KaTeX) e exportação de código-fonte pronto para compilação em **LuaLaTeX**, sendo plenamente extensível para qualquer disciplina acadêmica.

---

## Propósito do Projeto

Avaliações impressas em cursos universitários enfrentam desafios recorrentes:
1. **Fraudes e cola entre alunos**: resolvidos pela geração de múltiplas versões da mesma prova com embaralhamento determinístico de questões e alternativas.
2. **Morosidade na correção manual de provas objetivas**: automatizada por leitura óptica em tempo real (OMR), permitindo corrigir dezenas de folhas de respostas em minutos diretamente com a câmera do celular ou notebook.
3. **Segurança contra vazamento de respostas**: o gabarito oficial não precisa de banco de dados externo nem fica exposto; ele viaja cifrado dentro do próprio QR Code impresso no cartão-resposta com criptografia simétrica **AES-256-GCM** protegida pela senha mestra do professor.
4. **Custo zero de infraestrutura e privacidade total**: a aplicação é 100% executada no navegador do cliente (client-side), sem envio de dados de alunos ou imagens para servidores de terceiros, podendo ser hospedada gratuitamente no **GitHub Pages**.

---

## Principais Funcionalidades

### 1. Editor de Avaliações com Suporte Completo a LaTeX
- Inserção de equações inline ($f(x)$, $\lim_{x \to 0}$, matrizes) e destacadas com KaTeX em tempo real.
- Suporte a dois tipos de questões:
  - **Objetivas**: 2 a 5 alternativas (A a E), definição de chave correta e pontuação.
  - **Dissertativas (Abertas)**: Enunciado matemático e definição de espaço pautado para resposta/demonstração escrita (permanecem fora do cartão-resposta de bolinhas).
- Upload e incorporação de figuras, curvas e gráficos locais convertidos automaticamente para Data URL em base64 (sem dependência de links externos).

### 2. Randomizador de Versões e Embaralhamento
- Geração de $N$ versões da prova (Versões A, B, C, D...).
- Embaralhamento determinístico (PRNG Mulberry32 com seed reproduzível) das questões e das alternativas das questões objetivas.
- Mapeamento e recálculo automático das chaves de resposta de cada versão.

### 3. Cartão-Resposta A4 Padronizado & Segurança Criptográfica
- **Folha A4 Normalizada**: Projetada para ser a folha de capa do caderno de avaliação.
- **Marcadores Fiduciais**: 4 padrões de alinhamento de alta precisão nos cantos da folha para detecção óptica.
- **QR Code com AES-256-GCM**: O QR Code carrega os metadados da versão e o mapa completo do gabarito cifrado com derivação de chave **PBKDF2 (SHA-256 com 100.000 iterações)**. Se um aluno escanear o código no celular, verá apenas texto cifrado ininteligível (`MCORR:v1:...`).

### 4. Corretor Óptico OMR Autônomo
- Leitura instantânea via câmera (smartphone/notebook) ou por upload de fotos tiradas das folhas.
- **Independência total de estado**: Não é necessário recriar ou importar a prova no dispositivo de correção. Basta informar a senha da prova e apontar a câmera para qualquer cartão-resposta gerado pelo sistema.
- Algoritmo de amostragem de densidade óptica no Canvas com detecção automática de respostas corretas, incorretas, em branco e marcações múltiplas/rasuras.
- Espelho de correção detalhado na tela com nota imediata e inclusão automática no Livro de Notas da turma (exportável em CSV/Excel).

### 5. Diagramação Profissional e Exportação
- **Impressão A4 Rigorosa**: Diagramação direta em 1 ou 2 colunas pelo navegador (`@media print`), gerando PDFs limpos, sem bordas falsas, sem fundos azulados e sem páginas extras em branco.
- **Exportação LuaLaTeX (`.tex`)**: Gera código TeX moderno utilizando `fontspec` e `amsmath`, sem pacotes obsoletos (`inputenc`, `fontenc`) e com math mode estrito para siglas teóricas (ZF, ZFC, etc.).
- **Persistência em JSON**: Salve e recupere o banco de questões e configurações da prova em arquivos `.json` offline.

---

## Tecnologias Utilizadas

- **Framework Web**: React 18 + TypeScript + Vite
- **Estilização**: Tailwind CSS com regras tipográficas para impressão A4 (`@media print`)
- **Fórmulas Matemáticas**: KaTeX (renderização offline ultrarrápida)
- **Criptografia**: Web Crypto API nativa (`crypto.subtle` com AES-GCM e PBKDF2)
- **Leitura e Geração de Códigos**: `html5-qrcode` e `qrcode`
- **Ícones**: Lucide React
- **Testes Unitários**: Vitest

---

## Como Executar Localmente

### Pré-requisitos
- Node.js (versão 18 ou superior)
- npm

### Passos

```bash
# 1. Instalar as dependências
npm install

# 2. Iniciar o servidor de desenvolvimento
npm run dev

# 3. Executar a suíte de testes unitários
npm test

# 4. Gerar build otimizado para produção
npm run build
```

---

## Licença

Este projeto está sob a licença [GNU General Public License v3.0 (GPL-3.0)](LICENSE.md).

A licença deste projeto aplica-se exclusivamente ao código-fonte aqui desenvolvido e **não se estende** às bibliotecas, ferramentas e pacotes de terceiros utilizados como dependências (tais como React, KaTeX, Tailwind CSS, Lucide React, Vite, html5-qrcode, etc.). Para cada uma das dependências externas, o usuário deve consultar e cumprir as suas respectivas licenças de forma individual.

