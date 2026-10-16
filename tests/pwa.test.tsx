import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { UpdatePrompt } from '../src/components/pwa/UpdatePrompt';

describe('Plano 07 — PWA e Funcionamento Offline', () => {
  it('deve ter todos os ícones necessários na pasta public/', () => {
    const requiredIcons = [
      'pwa-192x192.png',
      'pwa-512x512.png',
      'pwa-maskable-512x512.png',
      'apple-touch-icon.png',
    ];

    for (const icon of requiredIcons) {
      const iconPath = path.resolve(__dirname, '../public', icon);
      expect(fs.existsSync(iconPath), `Ícone ausente: ${icon}`).toBe(true);
      const stat = fs.statSync(iconPath);
      expect(stat.size).toBeGreaterThan(0);
    }
  });

  it('index.html deve conter as tags para PWA e suporte a tela inicial móvel', () => {
    const indexPath = path.resolve(__dirname, '../index.html');
    const content = fs.readFileSync(indexPath, 'utf-8');

    expect(content).toContain('name="theme-color"');
    expect(content).toContain('rel="apple-touch-icon"');
    expect(content).toContain('apple-mobile-web-app-capable');
  });

  it('vite.config.ts deve configurar o VitePWA com prompt e cache ampliado', () => {
    const configPath = path.resolve(__dirname, '../vite.config.ts');
    const content = fs.readFileSync(configPath, 'utf-8');

    expect(content).toContain('VitePWA');
    expect(content).toContain("registerType: 'prompt'");
    expect(content).toContain('maximumFileSizeToCacheInBytes');
    expect(content).toContain("short_name: 'GabariTeX'");
  });

  it('UpdatePrompt renderiza sem erros no SSR / Node', () => {
    expect(() => {
      renderToString(<UpdatePrompt isBatchProcessing={false} />);
    }).not.toThrow();
  });
});
