---
title: Perfis, backup e restauração
---

# Perfis, backup e restauração

Guarde cópias de segurança das suas provas e turmas e transfira seus dados entre computadores.

## Antes de começar

No GabariTeX, seus dados pertencem a você e ficam armazenados localmente no seu dispositivo:

- Na versão para computador (**GabariTeX Desktop**), todas as avaliações, turmas e notas são gravadas no disco rígido do computador.
- Na versão Web, os dados são mantidos no banco de dados local do seu navegador de internet.
- Fazer cópias regulares em arquivo `.zip` protege seu trabalho contra falhas no sistema operacional, formatações do computador ou limpeza de dados do navegador, além de permitir transferir todas as suas turmas para outro equipamento.

## Passo a passo

### 1. Acessar o menu de perfil

No canto superior direito da janela, clique no botão **Perfil** para abrir o menu com as opções de backup e restauração.

<Screenshot id="perfis-backup-01-menu-perfil" />

O menu exibe um resumo da quantidade de avaliações, turmas e notas cadastradas no aparelho, junto com as opções **Exportar Perfil (ZIP)** e **Importar Perfil (ZIP)**.

### 2. Exportar o perfil completo em arquivo ZIP

Na janela de exportação, selecione o escopo desejado e clique em **Exportar Arquivo ZIP** para salvar a cópia compactada.

<Screenshot id="perfis-backup-02-modal-exportar" />

Você pode escolher exportar o perfil completo ou usar a opção personalizada para selecionar apenas avaliações específicas. É possível marcar ou desmarcar a inclusão de notas, turmas, banco de questões e senhas de leitura das provas. Guarde o arquivo gerado em uma pasta segura ou em um serviço de nuvem de sua preferência.

### 3. Importar dados em outro computador

Após selecionar o arquivo, confira o resumo dos itens identificados e clique em **Confirmar e Importar** para aplicar as informações.

<Screenshot id="perfis-backup-03-modal-importar" />

O GabariTeX analisa o arquivo ZIP e apresenta um balanço com a quantidade de novas provas, turmas, notas e questões do banco de questões encontradas. Você pode escolher entre dois modos de aplicação:

- *Mesclar com o perfil atual (Recomendado):* Preserva as provas e turmas existentes no computador e adiciona os novos dados sem apagar nada.
- *Substituir tudo:* Remove integralmente o perfil atual e instala apenas o conteúdo trazido no arquivo de backup.

### 4. Localizar backups automáticos diários no computador

No computador, acesse a pasta de documentos para encontrar as cópias diárias salvas automaticamente pelo GabariTeX Desktop.

O aplicativo para desktop cria uma cópia de segurança automática uma vez ao dia sempre que houver avaliações cadastradas. Esses arquivos ficam localizados na pasta `Documentos/GabariTeX/Backups` (ou `Documents/GabariTeX/Backups`).

O sistema mantém automaticamente os 10 arquivos mais recentes, descartando versões mais antigas para economizar espaço em disco. Para restaurar qualquer um desses pontos, basta abrir a tela de importação e selecionar o arquivo correspondente da pasta.

## Dicas para o dia a dia

- *Rotina ao final do bimestre:* Ao fechar as notas de cada ciclo ou semestre letivo, gere uma exportação completa e guarde o arquivo ZIP no Google Drive, OneDrive ou pendrive.
- *Compartilhamento de prova com colegas:* Para enviar uma prova elaborada para outro professor sem expor seus alunos nem suas turmas, use a opção *Compartilhar Prova com Colega* na janela de exportação.
- *Compartilhamento de grupos do banco:* Para compartilhar apenas um tópico ou matéria com colegas sem exportar seu perfil inteiro, use o botão de exportação da árvore no Banco de Questões para gerar um arquivo `.gabaritex-bank.zip`. O colega poderá usar a opção **Importar** na tela do banco para integrá-lo diretamente à árvore taxonômica dele.
- *Cuidado com senhas:* O arquivo exportado contém as senhas de conferência dos gabaritos. Mantenha seus arquivos de backup em locais com acesso protegido por senha.

## Se algo não funcionar

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| *Arquivo ZIP não é reconhecido na importação* | O arquivo foi corrompido durante o download ou não foi gerado pelo GabariTeX. | Gere uma nova exportação no computador de origem e transfira o arquivo novamente. |
| *Aviso de prova sem senha após importar* | O arquivo recebido foi gerado no modo de compartilhamento pedagógico sem senhas. | O GabariTeX gera uma nova senha automaticamente para permitir a leitura imediata das folhas. |
| *Pasta de backups automáticos não encontrada* | Você está utilizando a versão Web do GabariTeX ou a pasta de documentos possui permissões restritas. | A gravação em disco de snapshots diários é exclusiva do aplicativo desktop. Na web, utilize o botão de exportação manual. |
| *Turmas com mesmo nome após a importação* | Você importou com o modo *Mesclar* um arquivo que continha turmas já cadastradas com alterações. | Verifique as turmas no gerenciador e utilize a ferramenta de exclusão para remover a versão excedente se necessário. |
