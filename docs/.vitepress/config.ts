import { defineConfig } from 'vitepress';

export default defineConfig({
  lang: 'pt-BR',
  title: 'GabariTeX',
  description: 'Gerador de provas com LaTeX e corretor óptico de folhas de respostas com QR Code criptografado',
  base: '/GabariTeX/docs/',
  head: [
    ['link', { rel: 'icon', href: '/GabariTeX/docs/favicon.ico' }],
  ],
  srcExclude: ['screenshots/**/*.md'],
  vite: {
    define: {
      __DOCS_SHOW_PLACEHOLDERS__: JSON.stringify(process.env.DOCS_SHOW_PLACEHOLDERS === '1'),
    },
  },
  themeConfig: {
    outline: {
      label: 'Nesta página',
    },
    docFooter: {
      prev: 'Página anterior',
      next: 'Próxima página',
    },
    darkModeSwitchLabel: 'Aparência',
    lightModeSwitchTitle: 'Mudar para tema claro',
    darkModeSwitchTitle: 'Mudar para tema escuro',
    sidebarMenuLabel: 'Menu',
    returnToTopLabel: 'Voltar ao topo',
    lastUpdated: {
      text: 'Última atualização',
    },
    nav: [
      { text: 'Início', link: '/' },
      { text: 'Guia de Uso', link: '/primeiros-passos' },
      { text: 'Problemas Comuns', link: '/problemas-comuns' },
      { text: 'Sobre', link: '/sobre' },
    ],
    sidebar: [
      {
        text: 'Começando',
        items: [
          { text: 'Visão Geral', link: '/' },
          { text: 'Instalação', link: '/instalacao' },
          { text: 'Primeiros Passos', link: '/primeiros-passos' },
        ],
      },
      {
        text: 'Elaboração e Impressão',
        items: [
          { text: 'Criação de Provas', link: '/criar-prova' },
          { text: 'Banco de Questões', link: '/banco-de-questoes' },
          { text: 'Impressão de Cadernos e Gabaritos', link: '/imprimir' },
        ],
      },
      {
        text: 'Correção e Notas',
        items: [
          { text: 'Correção de Folhas de Resposta', link: '/corrigir' },
          { text: 'Câmera do Celular como Leitor', link: '/camera-celular' },
          { text: 'Turmas e Livro de Notas', link: '/turmas-notas' },
        ],
      },
      {
        text: 'Gerenciamento e Ajuda',
        items: [
          { text: 'Perfis e Backup', link: '/perfis-backup' },
          { text: 'Problemas Comuns', link: '/problemas-comuns' },
          { text: 'Sobre o GabariTeX', link: '/sobre' },
        ],
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/Eduardo-Furlan/GabariTeX' },
    ],
    search: {
      provider: 'local',
      options: {
        locales: {
          root: {
            translations: {
              button: {
                buttonText: 'Pesquisar',
                buttonAriaLabel: 'Pesquisar',
              },
              modal: {
                noResultsText: 'Nenhum resultado encontrado',
                resetButtonTitle: 'Limpar pesquisa',
                footer: {
                  selectText: 'para selecionar',
                  navigateText: 'para navegar',
                  closeText: 'para fechar',
                },
              },
            },
          },
        },
      },
    },
  },
});
