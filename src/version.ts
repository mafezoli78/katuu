/**
 * Versão do app — FONTE ÚNICA DE VERDADE: o campo "version" do package.json.
 *
 * Não edite números aqui. Para mudar a versão, rode:
 *   npm run version:set 4.3.3
 * (atualiza o package.json; o Vite injeta em build time via __APP_VERSION__,
 *  e o android/app/build.gradle lê o mesmo package.json para versionName/
 *  versionCode — ver build.gradle.)
 *
 * Marco 4.0.0 (jun/2026): consolidação pré-teste em grupo — sistema de
 * denúncias com suspensão progressiva, ciclo de vida de chat/waves unificado,
 * edição/exclusão/reações no chat, self card, gênero customizado, página de
 * acenos com histórico de sessão, filtros e validação de selfie.
 */

// Injetado pelo Vite (define em vite.config.ts) a partir do package.json.
declare const __APP_VERSION__: string;

export const APP_VERSION: string = __APP_VERSION__;

const [major, minor, patch] = APP_VERSION.split('.').map(Number);

export const version = { major, minor, patch } as const;
