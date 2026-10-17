import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ThemeSelector } from '../src/components/ThemeSelector';
import { setPreference, __resetThemeStoreForTests } from '../src/theme/themeStore';

describe('<ThemeSelector />', () => {
  beforeEach(() => {
    __resetThemeStoreForTests();
  });

  it('renderiza o radiogroup com as 3 opções Claro, Escuro e Sistema', () => {
    const html = renderToString(<ThemeSelector />);

    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-label="Tema visual"');

    // 3 opções role="radio"
    const radioMatches = html.match(/role="radio"/g);
    expect(radioMatches).toHaveLength(3);

    // Rótulos
    expect(html).toContain('Claro');
    expect(html).toContain('Escuro');
    expect(html).toContain('Sistema');

    // Exatamente uma opção com aria-checked="true"
    const checkedMatches = html.match(/aria-checked="true"/g);
    expect(checkedMatches).toHaveLength(1);
  });

  it('marca a opção correta conforme a preferência ativa', () => {
    setPreference('dark');
    const htmlDark = renderToString(<ThemeSelector />);
    expect(htmlDark).toContain('aria-checked="true"');
    expect(htmlDark).toContain('title="Tema escuro"');

    setPreference('light');
    const htmlLight = renderToString(<ThemeSelector />);
    expect(htmlLight).toContain('aria-checked="true"');
    expect(htmlLight).toContain('title="Tema claro"');
  });
});

