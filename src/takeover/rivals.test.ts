/**
 * Copyright 2026 The Tarn Authors
 * SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
 */

import {describe, expect, it} from 'vitest';
import {looksLikeNewTab} from './rivals';

describe('looksLikeNewTab', () => {
  it('spots extensions that replace the new tab page', () => {
    const cases: Array<[string, string]> = [
      ['Momentum', 'Replace new tab page with a personal dashboard.'],
      ['Infinity New Tab', ''],
      ['Tabliss', 'A beautiful, customizable New Tab page.'],
      ['Bonjourr · Minimalist Startpage', ''],
      ['Speed Dial 2', ''],
      ['Newtab Redirect', ''],
      ['Momentum', 'Remplace la page Nouvel onglet par un tableau de bord.'],
      ['Momentum', 'Ersetzt die Neuer-Tab-Seite durch ein Dashboard.'],
      ['Momentum', 'Заменяет страницу новой вкладки личной панелью.'],
      ['Momentum', '新しいタブページをダッシュボードに置き換えます。'],
      ['Momentum', '用个人仪表板替换新标签页。'],
      ['Momentum', '새 탭 페이지를 대시보드로 바꿉니다.'],
      ['Momentum', 'Yeni sekme sayfasını bir panoyla değiştirir.'],
      ['Momentum', 'Substitui a página de nova guia por um painel.'],
      ['Momentum', 'Reemplaza la página de nueva pestaña por un panel.'],
    ];
    for (const [name, description] of cases) {
      expect(
        looksLikeNewTab(name, description),
        `${name}: ${description}`,
      ).toBe(true);
    }
  });

  it('leaves other extensions alone, so they are never preselected', () => {
    const cases: Array<[string, string]> = [
      ['Google Analytics Dashboard', 'Your analytics at a glance.'],
      ['Jira Dashboard', 'See your issues.'],
      ['Homepage Speed Test', 'How fast is your home page?'],
      ['uBlock Origin', 'Finally, an efficient blocker.'],
      ['1Password', 'The best way to use passwords.'],
      ['Open Link', 'Opens every link in a new tab.'],
      ['Open Link', 'Open links in new tabs.'],
      ['Lien', 'Ouvre les liens dans un nouvel onglet.'],
      ['Link', 'Öffnet Links in einem neuen Tab.'],
      ['Ссылки', 'Открывает ссылки в новой вкладке.'],
      ['リンク', 'リンクを新しいタブで開きます。'],
      ['链接', '在新标签页中打开链接。'],
      ['링크', '링크를 새 탭에서 엽니다.'],
      ['Bağlantı', 'Bağlantıları yeni sekmede açar.'],
      ['Link', 'Abre links em uma nova aba.'],
      ['Enlace', 'Abre enlaces en una nueva pestaña.'],
    ];
    for (const [name, description] of cases) {
      expect(
        looksLikeNewTab(name, description),
        `${name}: ${description}`,
      ).toBe(false);
    }
  });
});
