/**
 * Versão única do app — fonte da verdade para a UI.
 * Manter alinhado com:
 *  - android/app/build.gradle → versionName "4.0.0" (+ versionCode incrementado)
 *  - tag Git correspondente (v4.0.0)
 *
 * Marco 4.0.0 (jun/2026): consolidação pré-teste em grupo — sistema de
 * denúncias com suspensão progressiva, ciclo de vida de chat/waves unificado,
 * edição/exclusão/reações no chat, self card, gênero customizado, página de
 * acenos com histórico de sessão, filtros e validação de selfie.
 */
export const version = {
  major: 4,
  minor: 0,
  patch: 1 as number,
} as const;

export const APP_VERSION = `${version.major}.${version.minor}.${version.patch}`;
