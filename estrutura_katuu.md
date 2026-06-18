# Estrutura do Projeto Katuu 4.1.0

Este documento apresenta a hierarquia completa de arquivos e pastas contidos no pacote `katuu_4.1.0.zip`.

## Visualização em Árvore

```text
katuu_4.1.0/
├── .env
├── .gitignore
├── .prettierrc
├── capacitor.config.ts
├── components.json
├── eslint.config.js
├── index.html
├── package-lock.json
├── package.json
├── postcss.config.js
├── public
│   ├── .well-known
│   │   └── assetlinks.json
│   ├── email-confirmado.html
│   ├── img
│   │   ├── icon-katuu.png
│   │   └── logo-katuu.png
│   ├── landing.html
│   ├── login-callback.html
│   ├── models
│   │   ├── tiny_face_detector_model-shard1
│   │   └── tiny_face_detector_model-weights_manifest.json
│   ├── reset-password.html
│   └── tutorial
│       ├── ana.jpg
│       └── carlos.jpg
├── resources
│   └── icon.png
├── src
│   ├── App.css
│   ├── App.tsx
│   ├── assets
│   │   ├── icon-katuu.png
│   │   ├── icon-temporary-place.svg
│   │   └── logo-katuu-oficial.png
│   ├── components
│   │   ├── auth
│   │   │   ├── AuthEmailStep.tsx
│   │   │   ├── AuthMainStep.tsx
│   │   │   ├── AuthPasswordStep.tsx
│   │   │   └── AuthRegisterStep.tsx
│   │   ├── chat
│   │   │   ├── ChatWindow.tsx
│   │   │   └── ConversationsList.tsx
│   │   ├── home
│   │   │   ├── PeopleList.tsx
│   │   │   ├── PersonCard.tsx
│   │   │   ├── PresenceStatusCard.tsx
│   │   │   └── SwipeActions.tsx
│   │   ├── icons
│   │   │   ├── HandshakeIcon.tsx
│   │   │   └── TemporaryPlaceIcon.tsx
│   │   ├── layout
│   │   │   ├── AppHeader.tsx
│   │   │   ├── BottomNav.tsx
│   │   │   └── MobileLayout.tsx
│   │   ├── location
│   │   │   ├── CheckinSelfie.tsx
│   │   │   ├── PlaceMap.tsx
│   │   │   └── PlaceSelector.tsx
│   │   ├── onboarding
│   │   │   └── InterestsStep.tsx
│   │   ├── profile
│   │   │   ├── DateOfBirthPicker.tsx
│   │   │   ├── EmailChangeDialog.tsx
│   │   │   ├── ImageCropper.tsx
│   │   │   ├── ProfileGateModal.tsx
│   │   │   └── SelfCard.tsx
│   │   ├── shared
│   │   │   ├── GlobalNotifications.tsx
│   │   │   └── ReportModal.tsx
│   │   ├── tutorial
│   │   │   ├── TutorialFlow.tsx
│   │   │   └── tutorialCharacters.ts
│   │   └── ui
│   │       ├── accordion.tsx
│   │       ├── alert-dialog.tsx
│   │       ├── alert.tsx
│   │       ├── aspect-ratio.tsx
│   │       ├── avatar.tsx
│   │       ├── badge.tsx
│   │       ├── breadcrumb.tsx
│   │       ├── button.tsx
│   │       ├── calendar.tsx
│   │       ├── card.tsx
│   │       ├── carousel.tsx
│   │       ├── chart.tsx
│   │       ├── checkbox.tsx
│   │       ├── collapsible.tsx
│   │       ├── command.tsx
│   │       ├── context-menu.tsx
│   │       ├── dialog.tsx
│   │       ├── drawer.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── form.tsx
│   │       ├── hover-card.tsx
│   │       ├── input-otp.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── menubar.tsx
│   │       ├── navigation-menu.tsx
│   │       ├── pagination.tsx
│   │       ├── popover.tsx
│   │       ├── progress.tsx
│   │       ├── radio-group.tsx
│   │       ├── resizable.tsx
│   │       ├── scroll-area.tsx
│   │       ├── select.tsx
│   │       ├── separator.tsx
│   │       ├── sheet.tsx
│   │       ├── sidebar.tsx
│   │       ├── skeleton.tsx
│   │       ├── slider.tsx
│   │       ├── sonner.tsx
│   │       ├── switch.tsx
│   │       ├── table.tsx
│   │       ├── tabs.tsx
│   │       ├── textarea.tsx
│   │       ├── toast.tsx
│   │       ├── toaster.tsx
│   │       ├── toggle-group.tsx
│   │       ├── toggle.tsx
│   │       ├── tooltip.tsx
│   │       └── use-toast.ts
│   ├── config
│   │   └── presence.ts
│   ├── contexts
│   │   ├── AuthContext.tsx
│   │   ├── ConversationsContext.tsx
│   │   └── RealtimeContext.tsx
│   ├── hooks
│   │   ├── presence
│   │   │   ├── index.ts
│   │   │   ├── types.ts
│   │   │   ├── usePresenceGPS.ts
│   │   │   ├── usePresenceLifecycle.ts
│   │   │   ├── usePresenceState.ts
│   │   │   └── usePresenceTimer.ts
│   │   ├── use-mobile.tsx
│   │   ├── useAutoPushSubscription.ts
│   │   ├── useChat.ts
│   │   ├── useConversations.tsx
│   │   ├── useHomeActions.ts
│   │   ├── useInteractionData.ts
│   │   ├── useInterestCategories.ts
│   │   ├── useKeyboardVisible.ts
│   │   ├── useMessages.ts
│   │   ├── usePendingAction.ts
│   │   ├── usePeopleNearby.ts
│   │   ├── usePresence.ts
│   │   ├── useProfile.ts
│   │   ├── useProfileGate.ts
│   │   ├── usePushNotifications.ts
│   │   ├── useReport.ts
│   │   ├── useTutorial.ts
│   │   ├── useUnreadMessages.ts
│   │   ├── useValidatePlaceDistance.ts
│   │   └── useWaves.ts
│   ├── index.css
│   ├── integrations
│   │   └── supabase
│   │       ├── client.ts
│   │       └── types.ts
│   ├── lib
│   │   ├── activeChat.ts
│   │   ├── interactionRules.ts
│   │   ├── logger.ts
│   │   ├── storage.ts
│   │   └── utils.ts
│   ├── main.tsx
│   ├── pages
│   │   ├── Auth.tsx
│   │   ├── Chat.tsx
│   │   ├── Debug.tsx
│   │   ├── Explore.tsx
│   │   ├── Home.tsx
│   │   ├── Location.tsx
│   │   ├── Onboarding.tsx
│   │   ├── Privacy.tsx
│   │   ├── Profile.tsx
│   │   ├── ResetPassword.tsx
│   │   ├── Splash.tsx
│   │   ├── Terms.tsx
│   │   └── Waves.tsx
│   ├── services
│   │   ├── cameraService.ts
│   │   └── placesService.ts
│   ├── test
│   │   ├── interactionRules.test.ts
│   │   ├── legacy
│   │   │   ├── README.md
│   │   │   └── example.legacy.ts
│   │   └── setup.ts
│   ├── types
│   │   ├── gender.ts
│   │   ├── interests.ts
│   │   └── presence.ts
│   ├── utils
│   │   ├── date.ts
│   │   ├── pendingAction.ts
│   │   └── profileCompletion.ts
│   ├── version.ts
│   └── vite-env.d.ts
├── supabase
│   ├── .temp
│   │   ├── cli-latest
│   │   └── linked-project.json
│   ├── config.toml
│   ├── functions
│   │   ├── .gitkeep
│   │   ├── cleanup-expired-presences
│   │   │   └── index.ts
│   │   ├── process-notification-queue
│   │   │   └── index.ts
│   │   ├── search-places
│   │   │   └── index.ts
│   │   ├── send-fcm
│   │   │   └── index.ts
│   │   └── send-push
│   │       └── index.ts
│   └── migrations
│       ├── 20260122154420_e26f657e-a170-462c-966b-c95fed81f107.sql
│       ├── 20260122154439_a90c7bb4-53e6-4019-8c2b-9860411729b2.sql
│       ├── 20260124131955_ed44c5d4-8d25-4ad8-a4cb-788d3ffcee29.sql
│       ├── 20260125133134_689c8ac1-2e5c-4e48-8692-10a57ccc38a8.sql
│       ├── 20260125135833_2d8442f5-fd5d-4c8e-9ef0-fe79744221ca.sql
│       ├── 20260126175653_82c57260-af83-4671-8ff6-82283fefe941.sql
│       ├── 20260127152723_d639a421-c9ed-4c94-b7a5-f29e8a318880.sql
│       ├── 20260127194417_d98dd1aa-2d1b-45db-b52f-c0fae7397153.sql
│       ├── 20260127195229_5747e58f-23c3-4ab1-a34a-5e5d8766f626.sql
│       ├── 20260127195506_2a16ed91-de30-4c67-9a9c-3c0dabb68d46.sql
│       ├── 20260127200951_1e19f62a-a439-4ce8-888e-bbe8f752ab99.sql
│       ├── 20260127221919_3dedbfd7-e893-4390-a5a4-7004d2361b6d.sql
│       ├── 20260127223143_24356846-350c-475e-8195-9c64075e0e74.sql
│       ├── 20260127223835_020a9a4f-fdd7-469a-b34b-2d3bd136b523.sql
│       ├── 20260127225318_93c2eea7-203c-4295-a840-006221500260.sql
│       ├── 20260129115825_50f1fa27-58b2-45f0-86a0-2443eed90571.sql
│       ├── 20260129203300_00b62e7d-ab89-4c89-b511-9c58789d3e5c.sql
│       ├── 20260130132058_794d4070-e8aa-4f63-a3a4-f3481eb0cecb.sql
│       ├── 20260130134824_31995e39-6b8c-4c83-80ac-c440fca8e42f.sql
│       ├── 20260202163504_3a97894d-952e-4aca-a82f-5ee36539ade2.sql
│       ├── 20260203171455_9b295ee8-4f5d-4849-8a32-7b3bf21353c6.sql
│       ├── 20260205221828_e6390eb4-2139-480c-a106-a51e8e21c2dd.sql
│       ├── 20260207194323_e09d8b34-7eaa-4864-a705-c3203a4bf5c9.sql
│       ├── 20260208113254_fc2df67b-9be1-4cdb-b129-7e44a12074bb.sql
│       ├── 20260211224359_83dc9b8b-1b4c-4745-a315-62057270afa5.sql
│       ├── 20260214224832_bb35a1d3-bc6f-40d4-9074-2c145f552c21.sql
│       ├── 20260221115542_1936d8db-3f59-4885-a5bb-68149d485c1a.sql
│       ├── 20260224181118_2b15311a-3094-4242-826c-79a6a495e750.sql
│       ├── 20260301165114_4717f64a-062d-457e-afcf-b1b99f1e8fe5.sql
│       ├── 20260306120150_7cb6c692-c9cf-4a87-bab1-247181d82dba.sql
│       ├── 20260308220824_283204c0-5057-4bc1-8d0f-7bb755c91e56.sql
│       ├── 20260308221222_be3f7d79-6300-45ae-a4de-307456660305.sql
│       ├── 20260308221252_a59ff566-0650-42af-99aa-971ed97ce78d.sql
│       ├── 20260308221639_ad69cd1d-ba45-407d-9a1a-e3835eb29fba.sql
│       ├── 20260308221909_7dbeda30-a285-4736-87d2-01010cf05de8.sql
│       ├── 20260308222401_ea43e65f-44c7-422d-892f-5231b8eef56c.sql
│       ├── 20260308222653_5118d468-0f23-4861-b693-5032089316e6.sql
│       ├── 20260308223231_d32e57ea-6246-4fc1-ad94-9b3e32b9c670.sql
│       ├── 20260308223254_94b988c0-31cf-4db3-b298-6b262707fa4e.sql
│       ├── 20260308223342_9ff72800-ca03-44f1-b166-38e0f71fed74.sql
│       ├── 20260308223710_94658435-de4e-4ded-b6bc-6e32efde771f.sql
│       ├── 20260308223928_d523d345-ce13-4bf5-ab05-f557ca680741.sql
│       ├── 20260308224331_5f58dfbc-70f2-4c4d-9e14-59a4be378ace.sql
│       ├── 20260308224357_537ce682-0665-49a1-aeb5-53f391a91ee3.sql
│       ├── 20260308224627_e3c91fa6-1834-44f7-b69d-a19332ae26d2.sql
│       ├── 20260308224903_ccd14b12-5223-4d1e-b78b-275d24d8cce9.sql
│       ├── 20260308231356_f366ba3d-91a1-49bd-90a6-31fe983a8a95.sql
│       ├── 20260308231650_ebcf7bf4-28d1-470c-b3e5-08cbb6cef045.sql
│       ├── 20260308232825_d7be2d39-5f7e-4e38-a501-b54f3cf3d1ca.sql
│       ├── 20260308234442_cac5db9b-cbed-4aa7-9336-3c6dd9cdb9ac.sql
│       ├── 20260308234925_9a40d565-29df-4d54-9a2c-2a2249f348ad.sql
│       ├── 20260309005901_8f5bedc1-07d3-4e96-b74d-9ac8fd4d73e7.sql
│       ├── 20260310140131_c66427e6-b68f-404f-b85b-397226d91a5b.sql
│       ├── 20260312191229_3e775f7c-8a73-47cf-8ecf-acf3b7f91fe6.sql
│       ├── 20260312203507_b2b12a5f-464c-4824-972e-a4f82d5e0dad.sql
│       ├── 20260312211454_198baf0c-68a2-4614-abdf-c2f6f5b5fdca.sql
│       └── 20260313005615_04e16e90-c664-4f1e-af80-48e4483ae00a.sql
├── tailwind.config.ts
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
├── vercel.json
├── vite.config.ts
├── vitest.config.ts
└── workflows
    └── format.yml
```

## Lista Completa de Caminhos

| Tipo | Caminho |
| :--- | :--- |
| Arquivo | `.env` |
| Arquivo | `.gitignore` |
| Arquivo | `.prettierrc` |
| Arquivo | `capacitor.config.ts` |
| Arquivo | `components.json` |
| Arquivo | `eslint.config.js` |
| Arquivo | `index.html` |
| Arquivo | `package-lock.json` |
| Arquivo | `package.json` |
| Arquivo | `postcss.config.js` |
| Pasta | `public/` |
| Pasta | `public/.well-known/` |
| Arquivo | `public/.well-known/assetlinks.json` |
| Arquivo | `public/email-confirmado.html` |
| Pasta | `public/img/` |
| Arquivo | `public/img/icon-katuu.png` |
| Arquivo | `public/img/logo-katuu.png` |
| Arquivo | `public/landing.html` |
| Arquivo | `public/login-callback.html` |
| Pasta | `public/models/` |
| Arquivo | `public/models/tiny_face_detector_model-shard1` |
| Arquivo | `public/models/tiny_face_detector_model-weights_manifest.json` |
| Arquivo | `public/reset-password.html` |
| Pasta | `public/tutorial/` |
| Arquivo | `public/tutorial/ana.jpg` |
| Arquivo | `public/tutorial/carlos.jpg` |
| Pasta | `resources/` |
| Arquivo | `resources/icon.png` |
| Pasta | `src/` |
| Arquivo | `src/App.css` |
| Arquivo | `src/App.tsx` |
| Pasta | `src/assets/` |
| Arquivo | `src/assets/icon-katuu.png` |
| Arquivo | `src/assets/icon-temporary-place.svg` |
| Arquivo | `src/assets/logo-katuu-oficial.png` |
| Pasta | `src/components/` |
| Pasta | `src/components/auth/` |
| Arquivo | `src/components/auth/AuthEmailStep.tsx` |
| Arquivo | `src/components/auth/AuthMainStep.tsx` |
| Arquivo | `src/components/auth/AuthPasswordStep.tsx` |
| Arquivo | `src/components/auth/AuthRegisterStep.tsx` |
| Pasta | `src/components/chat/` |
| Arquivo | `src/components/chat/ChatWindow.tsx` |
| Arquivo | `src/components/chat/ConversationsList.tsx` |
| Pasta | `src/components/home/` |
| Arquivo | `src/components/home/PeopleList.tsx` |
| Arquivo | `src/components/home/PersonCard.tsx` |
| Arquivo | `src/components/home/PresenceStatusCard.tsx` |
| Arquivo | `src/components/home/SwipeActions.tsx` |
| Pasta | `src/components/icons/` |
| Arquivo | `src/components/icons/HandshakeIcon.tsx` |
| Arquivo | `src/components/icons/TemporaryPlaceIcon.tsx` |
| Pasta | `src/components/layout/` |
| Arquivo | `src/components/layout/AppHeader.tsx` |
| Arquivo | `src/components/layout/BottomNav.tsx` |
| Arquivo | `src/components/layout/MobileLayout.tsx` |
| Pasta | `src/components/location/` |
| Arquivo | `src/components/location/CheckinSelfie.tsx` |
| Arquivo | `src/components/location/PlaceMap.tsx` |
| Arquivo | `src/components/location/PlaceSelector.tsx` |
| Pasta | `src/components/onboarding/` |
| Arquivo | `src/components/onboarding/InterestsStep.tsx` |
| Pasta | `src/components/profile/` |
| Arquivo | `src/components/profile/DateOfBirthPicker.tsx` |
| Arquivo | `src/components/profile/EmailChangeDialog.tsx` |
| Arquivo | `src/components/profile/ImageCropper.tsx` |
| Arquivo | `src/components/profile/ProfileGateModal.tsx` |
| Arquivo | `src/components/profile/SelfCard.tsx` |
| Pasta | `src/components/shared/` |
| Arquivo | `src/components/shared/GlobalNotifications.tsx` |
| Arquivo | `src/components/shared/ReportModal.tsx` |
| Pasta | `src/components/tutorial/` |
| Arquivo | `src/components/tutorial/TutorialFlow.tsx` |
| Arquivo | `src/components/tutorial/tutorialCharacters.ts` |
| Pasta | `src/components/ui/` |
| Arquivo | `src/components/ui/accordion.tsx` |
| Arquivo | `src/components/ui/alert-dialog.tsx` |
| Arquivo | `src/components/ui/alert.tsx` |
| Arquivo | `src/components/ui/aspect-ratio.tsx` |
| Arquivo | `src/components/ui/avatar.tsx` |
| Arquivo | `src/components/ui/badge.tsx` |
| Arquivo | `src/components/ui/breadcrumb.tsx` |
| Arquivo | `src/components/ui/button.tsx` |
| Arquivo | `src/components/ui/calendar.tsx` |
| Arquivo | `src/components/ui/card.tsx` |
| Arquivo | `src/components/ui/carousel.tsx` |
| Arquivo | `src/components/ui/chart.tsx` |
| Arquivo | `src/components/ui/checkbox.tsx` |
| Arquivo | `src/components/ui/collapsible.tsx` |
| Arquivo | `src/components/ui/command.tsx` |
| Arquivo | `src/components/ui/context-menu.tsx` |
| Arquivo | `src/components/ui/dialog.tsx` |
| Arquivo | `src/components/ui/drawer.tsx` |
| Arquivo | `src/components/ui/dropdown-menu.tsx` |
| Arquivo | `src/components/ui/form.tsx` |
| Arquivo | `src/components/ui/hover-card.tsx` |
| Arquivo | `src/components/ui/input-otp.tsx` |
| Arquivo | `src/components/ui/input.tsx` |
| Arquivo | `src/components/ui/label.tsx` |
| Arquivo | `src/components/ui/menubar.tsx` |
| Arquivo | `src/components/ui/navigation-menu.tsx` |
| Arquivo | `src/components/ui/pagination.tsx` |
| Arquivo | `src/components/ui/popover.tsx` |
| Arquivo | `src/components/ui/progress.tsx` |
| Arquivo | `src/components/ui/radio-group.tsx` |
| Arquivo | `src/components/ui/resizable.tsx` |
| Arquivo | `src/components/ui/scroll-area.tsx` |
| Arquivo | `src/components/ui/select.tsx` |
| Arquivo | `src/components/ui/separator.tsx` |
| Arquivo | `src/components/ui/sheet.tsx` |
| Arquivo | `src/components/ui/sidebar.tsx` |
| Arquivo | `src/components/ui/skeleton.tsx` |
| Arquivo | `src/components/ui/slider.tsx` |
| Arquivo | `src/components/ui/sonner.tsx` |
| Arquivo | `src/components/ui/switch.tsx` |
| Arquivo | `src/components/ui/table.tsx` |
| Arquivo | `src/components/ui/tabs.tsx` |
| Arquivo | `src/components/ui/textarea.tsx` |
| Arquivo | `src/components/ui/toast.tsx` |
| Arquivo | `src/components/ui/toaster.tsx` |
| Arquivo | `src/components/ui/toggle-group.tsx` |
| Arquivo | `src/components/ui/toggle.tsx` |
| Arquivo | `src/components/ui/tooltip.tsx` |
| Arquivo | `src/components/ui/use-toast.ts` |
| Pasta | `src/config/` |
| Arquivo | `src/config/presence.ts` |
| Pasta | `src/contexts/` |
| Arquivo | `src/contexts/AuthContext.tsx` |
| Arquivo | `src/contexts/ConversationsContext.tsx` |
| Arquivo | `src/contexts/RealtimeContext.tsx` |
| Pasta | `src/hooks/` |
| Pasta | `src/hooks/presence/` |
| Arquivo | `src/hooks/presence/index.ts` |
| Arquivo | `src/hooks/presence/types.ts` |
| Arquivo | `src/hooks/presence/usePresenceGPS.ts` |
| Arquivo | `src/hooks/presence/usePresenceLifecycle.ts` |
| Arquivo | `src/hooks/presence/usePresenceState.ts` |
| Arquivo | `src/hooks/presence/usePresenceTimer.ts` |
| Arquivo | `src/hooks/use-mobile.tsx` |
| Arquivo | `src/hooks/useAutoPushSubscription.ts` |
| Arquivo | `src/hooks/useChat.ts` |
| Arquivo | `src/hooks/useConversations.tsx` |
| Arquivo | `src/hooks/useHomeActions.ts` |
| Arquivo | `src/hooks/useInteractionData.ts` |
| Arquivo | `src/hooks/useInterestCategories.ts` |
| Arquivo | `src/hooks/useKeyboardVisible.ts` |
| Arquivo | `src/hooks/useMessages.ts` |
| Arquivo | `src/hooks/usePendingAction.ts` |
| Arquivo | `src/hooks/usePeopleNearby.ts` |
| Arquivo | `src/hooks/usePresence.ts` |
| Arquivo | `src/hooks/useProfile.ts` |
| Arquivo | `src/hooks/useProfileGate.ts` |
| Arquivo | `src/hooks/usePushNotifications.ts` |
| Arquivo | `src/hooks/useReport.ts` |
| Arquivo | `src/hooks/useTutorial.ts` |
| Arquivo | `src/hooks/useUnreadMessages.ts` |
| Arquivo | `src/hooks/useValidatePlaceDistance.ts` |
| Arquivo | `src/hooks/useWaves.ts` |
| Arquivo | `src/index.css` |
| Pasta | `src/integrations/` |
| Pasta | `src/integrations/supabase/` |
| Arquivo | `src/integrations/supabase/client.ts` |
| Arquivo | `src/integrations/supabase/types.ts` |
| Pasta | `src/lib/` |
| Arquivo | `src/lib/activeChat.ts` |
| Arquivo | `src/lib/interactionRules.ts` |
| Arquivo | `src/lib/logger.ts` |
| Arquivo | `src/lib/storage.ts` |
| Arquivo | `src/lib/utils.ts` |
| Arquivo | `src/main.tsx` |
| Pasta | `src/pages/` |
| Arquivo | `src/pages/Auth.tsx` |
| Arquivo | `src/pages/Chat.tsx` |
| Arquivo | `src/pages/Debug.tsx` |
| Arquivo | `src/pages/Explore.tsx` |
| Arquivo | `src/pages/Home.tsx` |
| Arquivo | `src/pages/Location.tsx` |
| Arquivo | `src/pages/Onboarding.tsx` |
| Arquivo | `src/pages/Privacy.tsx` |
| Arquivo | `src/pages/Profile.tsx` |
| Arquivo | `src/pages/ResetPassword.tsx` |
| Arquivo | `src/pages/Splash.tsx` |
| Arquivo | `src/pages/Terms.tsx` |
| Arquivo | `src/pages/Waves.tsx` |
| Pasta | `src/services/` |
| Arquivo | `src/services/cameraService.ts` |
| Arquivo | `src/services/placesService.ts` |
| Pasta | `src/test/` |
| Arquivo | `src/test/interactionRules.test.ts` |
| Pasta | `src/test/legacy/` |
| Arquivo | `src/test/legacy/README.md` |
| Arquivo | `src/test/legacy/example.legacy.ts` |
| Arquivo | `src/test/setup.ts` |
| Pasta | `src/types/` |
| Arquivo | `src/types/gender.ts` |
| Arquivo | `src/types/interests.ts` |
| Arquivo | `src/types/presence.ts` |
| Pasta | `src/utils/` |
| Arquivo | `src/utils/date.ts` |
| Arquivo | `src/utils/pendingAction.ts` |
| Arquivo | `src/utils/profileCompletion.ts` |
| Arquivo | `src/version.ts` |
| Arquivo | `src/vite-env.d.ts` |
| Pasta | `supabase/` |
| Pasta | `supabase/.temp/` |
| Arquivo | `supabase/.temp/cli-latest` |
| Arquivo | `supabase/.temp/linked-project.json` |
| Arquivo | `supabase/config.toml` |
| Pasta | `supabase/functions/` |
| Arquivo | `supabase/functions/.gitkeep` |
| Pasta | `supabase/functions/cleanup-expired-presences/` |
| Arquivo | `supabase/functions/cleanup-expired-presences/index.ts` |
| Pasta | `supabase/functions/process-notification-queue/` |
| Arquivo | `supabase/functions/process-notification-queue/index.ts` |
| Pasta | `supabase/functions/search-places/` |
| Arquivo | `supabase/functions/search-places/index.ts` |
| Pasta | `supabase/functions/send-fcm/` |
| Arquivo | `supabase/functions/send-fcm/index.ts` |
| Pasta | `supabase/functions/send-push/` |
| Arquivo | `supabase/functions/send-push/index.ts` |
| Pasta | `supabase/migrations/` |
| Arquivo | `supabase/migrations/20260122154420_e26f657e-a170-462c-966b-c95fed81f107.sql` |
| Arquivo | `supabase/migrations/20260122154439_a90c7bb4-53e6-4019-8c2b-9860411729b2.sql` |
| Arquivo | `supabase/migrations/20260124131955_ed44c5d4-8d25-4ad8-a4cb-788d3ffcee29.sql` |
| Arquivo | `supabase/migrations/20260125133134_689c8ac1-2e5c-4e48-8692-10a57ccc38a8.sql` |
| Arquivo | `supabase/migrations/20260125135833_2d8442f5-fd5d-4c8e-9ef0-fe79744221ca.sql` |
| Arquivo | `supabase/migrations/20260126175653_82c57260-af83-4671-8ff6-82283fefe941.sql` |
| Arquivo | `supabase/migrations/20260127152723_d639a421-c9ed-4c94-b7a5-f29e8a318880.sql` |
| Arquivo | `supabase/migrations/20260127194417_d98dd1aa-2d1b-45db-b52f-c0fae7397153.sql` |
| Arquivo | `supabase/migrations/20260127195229_5747e58f-23c3-4ab1-a34a-5e5d8766f626.sql` |
| Arquivo | `supabase/migrations/20260127195506_2a16ed91-de30-4c67-9a9c-3c0dabb68d46.sql` |
| Arquivo | `supabase/migrations/20260127200951_1e19f62a-a439-4ce8-888e-bbe8f752ab99.sql` |
| Arquivo | `supabase/migrations/20260127221919_3dedbfd7-e893-4390-a5a4-7004d2361b6d.sql` |
| Arquivo | `supabase/migrations/20260127223143_24356846-350c-475e-8195-9c64075e0e74.sql` |
| Arquivo | `supabase/migrations/20260127223835_020a9a4f-fdd7-469a-b34b-2d3bd136b523.sql` |
| Arquivo | `supabase/migrations/20260127225318_93c2eea7-203c-4295-a840-006221500260.sql` |
| Arquivo | `supabase/migrations/20260129115825_50f1fa27-58b2-45f0-86a0-2443eed90571.sql` |
| Arquivo | `supabase/migrations/20260129203300_00b62e7d-ab89-4c89-b511-9c58789d3e5c.sql` |
| Arquivo | `supabase/migrations/20260130132058_794d4070-e8aa-4f63-a3a4-f3481eb0cecb.sql` |
| Arquivo | `supabase/migrations/20260130134824_31995e39-6b8c-4c83-80ac-c440fca8e42f.sql` |
| Arquivo | `supabase/migrations/20260202163504_3a97894d-952e-4aca-a82f-5ee36539ade2.sql` |
| Arquivo | `supabase/migrations/20260203171455_9b295ee8-4f5d-4849-8a32-7b3bf21353c6.sql` |
| Arquivo | `supabase/migrations/20260205221828_e6390eb4-2139-480c-a106-a51e8e21c2dd.sql` |
| Arquivo | `supabase/migrations/20260207194323_e09d8b34-7eaa-4864-a705-c3203a4bf5c9.sql` |
| Arquivo | `supabase/migrations/20260208113254_fc2df67b-9be1-4cdb-b129-7e44a12074bb.sql` |
| Arquivo | `supabase/migrations/20260211224359_83dc9b8b-1b4c-4745-a315-62057270afa5.sql` |
| Arquivo | `supabase/migrations/20260214224832_bb35a1d3-bc6f-40d4-9074-2c145f552c21.sql` |
| Arquivo | `supabase/migrations/20260221115542_1936d8db-3f59-4885-a5bb-68149d485c1a.sql` |
| Arquivo | `supabase/migrations/20260224181118_2b15311a-3094-4242-826c-79a6a495e750.sql` |
| Arquivo | `supabase/migrations/20260301165114_4717f64a-062d-457e-afcf-b1b99f1e8fe5.sql` |
| Arquivo | `supabase/migrations/20260306120150_7cb6c692-c9cf-4a87-bab1-247181d82dba.sql` |
| Arquivo | `supabase/migrations/20260308220824_283204c0-5057-4bc1-8d0f-7bb755c91e56.sql` |
| Arquivo | `supabase/migrations/20260308221222_be3f7d79-6300-45ae-a4de-307456660305.sql` |
| Arquivo | `supabase/migrations/20260308221252_a59ff566-0650-42af-99aa-971ed97ce78d.sql` |
| Arquivo | `supabase/migrations/20260308221639_ad69cd1d-ba45-407d-9a1a-e3835eb29fba.sql` |
| Arquivo | `supabase/migrations/20260308221909_7dbeda30-a285-4736-87d2-01010cf05de8.sql` |
| Arquivo | `supabase/migrations/20260308222401_ea43e65f-44c7-422d-892f-5231b8eef56c.sql` |
| Arquivo | `supabase/migrations/20260308222653_5118d468-0f23-4861-b693-5032089316e6.sql` |
| Arquivo | `supabase/migrations/20260308223231_d32e57ea-6246-4fc1-ad94-9b3e32b9c670.sql` |
| Arquivo | `supabase/migrations/20260308223254_94b988c0-31cf-4db3-b298-6b262707fa4e.sql` |
| Arquivo | `supabase/migrations/20260308223342_9ff72800-ca03-44f1-b166-38e0f71fed74.sql` |
| Arquivo | `supabase/migrations/20260308223710_94658435-de4e-4ded-b6bc-6e32efde771f.sql` |
| Arquivo | `supabase/migrations/20260308223928_d523d345-ce13-4bf5-ab05-f557ca680741.sql` |
| Arquivo | `supabase/migrations/20260308224331_5f58dfbc-70f2-4c4d-9e14-59a4be378ace.sql` |
| Arquivo | `supabase/migrations/20260308224357_537ce682-0665-49a1-aeb5-53f391a91ee3.sql` |
| Arquivo | `supabase/migrations/20260308224627_e3c91fa6-1834-44f7-b69d-a19332ae26d2.sql` |
| Arquivo | `supabase/migrations/20260308224903_ccd14b12-5223-4d1e-b78b-275d24d8cce9.sql` |
| Arquivo | `supabase/migrations/20260308231356_f366ba3d-91a1-49bd-90a6-31fe983a8a95.sql` |
| Arquivo | `supabase/migrations/20260308231650_ebcf7bf4-28d1-470c-b3e5-08cbb6cef045.sql` |
| Arquivo | `supabase/migrations/20260308232825_d7be2d39-5f7e-4e38-a501-b54f3cf3d1ca.sql` |
| Arquivo | `supabase/migrations/20260308234442_cac5db9b-cbed-4aa7-9336-3c6dd9cdb9ac.sql` |
| Arquivo | `supabase/migrations/20260308234925_9a40d565-29df-4d54-9a2c-2a2249f348ad.sql` |
| Arquivo | `supabase/migrations/20260309005901_8f5bedc1-07d3-4e96-b74d-9ac8fd4d73e7.sql` |
| Arquivo | `supabase/migrations/20260310140131_c66427e6-b68f-404f-b85b-397226d91a5b.sql` |
| Arquivo | `supabase/migrations/20260312191229_3e775f7c-8a73-47cf-8ecf-acf3b7f91fe6.sql` |
| Arquivo | `supabase/migrations/20260312203507_b2b12a5f-464c-4824-972e-a4f82d5e0dad.sql` |
| Arquivo | `supabase/migrations/20260312211454_198baf0c-68a2-4614-abdf-c2f6f5b5fdca.sql` |
| Arquivo | `supabase/migrations/20260313005615_04e16e90-c664-4f1e-af80-48e4483ae00a.sql` |
| Arquivo | `tailwind.config.ts` |
| Arquivo | `tsconfig.app.json` |
| Arquivo | `tsconfig.json` |
| Arquivo | `tsconfig.node.json` |
| Arquivo | `vercel.json` |
| Arquivo | `vite.config.ts` |
| Arquivo | `vitest.config.ts` |
| Pasta | `workflows/` |
| Arquivo | `workflows/format.yml` |
