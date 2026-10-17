import { defineConfig } from 'vitepress';

export default defineConfig({
  lang: 'pt-BR',
  title: 'GabariTeX',
  description: 'Gerador de provas com LaTeX e corretor óptico de folhas de respostas com QR Code criptografado',
  base: '/GabariTeX/docs/',
  srcExclude: ['screenshots/**/*.md'],
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
