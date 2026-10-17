---
title: Sobre o GabariTeX
---

# Sobre o GabariTeX

Um projeto de código aberto pensado para facilitar o dia a dia de professores.

## O que é o projeto

O **GabariTeX** nasceu da necessidade real de simplificar a elaboração, diagramação e correção de avaliações escolares no dia a dia da sala de aula.

Professores gastam horas preciosas diagramando provas manualmente em editores de texto convencionais, embaralhando alternativas para evitar cola e corrigindo pilhas de folhas de respostas à mão. Ferramentas comerciais existentes costumam cobrar assinaturas caras, exigir conexão ininterrupta com servidores remotos ou demandar scanners especiais de alto custo.

O GabariTeX resolve esse desafio ao reunir:

- *Criação rápida com tipografia matemática:* editor visual com suporte completo a fórmulas LaTeX via KaTeX, sem necessidade de configurar compiladores complexos.
- *Diagramação A4 padronizada:* geração automática de cadernos de prova compactos e cartões de resposta otimizados com marcadores de leitura rápida.
- *Randomização segura de versões:* embaralhamento automático de questões e alternativas, com gabaritos codificados de forma criptografada em um código QR impresso na própria folha.
- *Correção óptica nativa e sem fios:* leitura das marcações utilizando visão computacional diretamente no computador ou pareando a câmera de qualquer smartphone pela rede local Wi-Fi, sem enviar fotos de alunos para servidores externos.
- *Privacidade e soberania de dados:* seus alunos, turmas e notas ficam guardados exclusivamente nos seus próprios aparelhos.

## Versão atual

A versão documentada neste guia é a `1.0.0`, marcando o primeiro lançamento oficial e estável para uso em produção por escolas, universidades e cursos preparatórios.

## Licença e liberdade de uso

O GabariTeX é distribuído como software livre sob a licença *GPL-3.0-or-later* (GNU General Public License v3 ou posterior).

Em termos práticos para o professor e para a instituição de ensino, isso significa que:

- O aplicativo é gratuito para uso pessoal, pedagógico ou institucional, sem cobrança de assinaturas, limites de provas ou bloqueios de funcionalidades.
- O código-fonte é público e auditável, garantindo que não há rastreadores ocultos nem coleta indevida de dados dos estudantes.
- Qualquer pessoa pode estudar, aprimorar ou adaptar o programa para as necessidades específicas de sua rede educacional.

## Autoria e comunidade

O projeto foi idealizado e desenvolvido por:

- *Eduardo Furlan*
- *Eduardo C. Lunardi*

## Como contribuir ou relatar problemas

O desenvolvimento do GabariTeX acontece de forma aberta no GitHub. Sugestões de melhorias, relatos de falhas e contribuições de código são muito bem-vindos:

- *Repositório principal:* [github.com/Eduardo-Furlan/GabariTeX](https://github.com/Eduardo-Furlan/GabariTeX)
- *Relato de erros e sugestões:* [Central de Issues](https://github.com/Eduardo-Furlan/GabariTeX/issues)
- *Documentação online:* [Eduardo-Furlan.github.io/GabariTeX/docs/](https://eduardo-furlan.github.io/GabariTeX/docs/)

Ao relatar uma falha na correção de folhas ou na impressão, informe seu sistema operacional (Linux, Windows ou navegador web) e, se possível, anexe uma imagem de exemplo para que possamos reproduzir e corrigir rapidamente.

## Créditos e tecnologias

O GabariTeX foi construído utilizando tecnologias modernas de alto desempenho:

- *Interface e aplicação:* React, Vite, TypeScript e Tailwind CSS.
- *Motor de aplicativo para computador:* Tauri (Rust), garantindo baixo consumo de memória e inicialização instantânea.
- *Visão computacional e leitura óptica:* OpenCV e algoritmos de detecção geométrica fiducial.
- *Leitura e geração de códigos QR:* html5-qrcode e bibliotecas nativas de decodificação.
- *Renderização de fórmulas matemáticas:* KaTeX e compiladores LaTeX de alta qualidade.
- *Ícones e componentes visuais:* Lucide Icons.
