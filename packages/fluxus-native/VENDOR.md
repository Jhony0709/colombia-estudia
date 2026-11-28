# @fluxus-ui/native, copiado

**No se edita aquí.** Es una copia de `~/development/fluxus/packages/native` (Fluxus, la librería de
Jhonny) mientras la versión que usa la app no esté en npm: la 0.1.0 lo está, esta 0.2.0 no.
Decisión: `PRODUCT_DECISIONS.md`, «App móvil con Expo y `@fluxus-ui/native`» (27/11);
diseño y límites en `fluxus/SPEC.md` §15, y el nombre en §16.1.

- **Qué se copió:** `src/` entero y `package.json` sin `devDependencies` ni `scripts` (las pruebas
  de la librería viven en Fluxus).
- **Cuándo:** 2026-11-27, quinta copia, versión 0.2.0, con `fluxus/SPEC.md` en §15.11: `Link` espera
  la promesa de `onPress`. La cuarta fue en §15.10 (`Bubble`, `Link`, `AudioPlayer`, la entrada
  `audio` y `scrollRef`/`scrollProps` en `Screen`), la tercera en §16.1 (el paso de `@fluxus/native`
  a `@fluxus-ui/native`), la segunda en §15.9 y la primera en §15.4.
- **Entradas aparte:** `@fluxus-ui/native/screen` (necesita `react-native-safe-area-context`),
  `@fluxus-ui/native/audio` (`expo-audio`, que la app tiene), `@fluxus-ui/native/icon`
  (`react-native-svg`, que la app no tiene) y `@fluxus-ui/native/blur` (`expo-blur`, que tampoco).
- **Si falta algo o hay un fallo:** se pide en el chat de Fluxus, se arregla allí y se vuelve a
  copiar la carpeta entera. Un cambio hecho aquí se pierde en la siguiente copia.
- **Cómo saber si alguien lo tocó:** `sha256sum` de cada fichero de `src/` al copiarlo:

```
de4cadee4d80e37282c85d167b795b969c204632c188b713cd121a97eae037cf  AudioPlayer.tsx
f38797d9ab57ad86c34ad5cee63a0b86ad5f4ea4bb01fdbc16c5db5666b31f67  Avatar.tsx
d2ad7f19c1b44aca6a4fd562190c2bc7a93a9c285dd8d458982a0b5ca8a3a177  Badge.tsx
50632c3d4de917e4a4d1390f4d8de995d15329fd8023a1fc39a0249e2dbcfa8d  BottomSheet.tsx
85b8e90e4e1530165a000b1915ceb3077b87e0be4dc3df54cf47f73acb3ec99f  Bubble.tsx
32519fd0f38df2f56db62f1aba262135c0ad4e25bfc0127c33f6e6fe604c1131  Button.tsx
4499a3d094c9f4809111583201f7bf8f7b7e6cc9f02ebd5c4e23ef5f76e96424  Card.tsx
ece9c830f56dccd97440f00503670fc2d870ff71482f18de5d8d2628a90a3b70  Dialog.tsx
3e96bfeae06b94735a260083e8e6f2de3cdec24b54239e72400b42590e65a769  Disclosure.tsx
2328e66b86764aa95895e7ef1a7c4d4149de9d005bbd91af0165371fd700237a  EmptyState.tsx
64a92e75ff3c94ba76f879e88fe4e48e1883f1e85b9d24b6c1d0faa8d2c07598  Link.tsx
e4dc5af6d0498be8a2d92a73bd9ed3d56d305df001a74bf50d799abb325aef34  ListItem.tsx
518d8b634c72589e55fa7e286daf83d133a69fe50022627f1ec7251c23274330  Menu.tsx
06c11c897ce4439ec9ff07cd46d7819842453d1d2e648224b60ca499ceb50ec1  Message.tsx
c9f9e5efdadb272c78c6108e1de8f39824750f9218c4875cecb4f71838910a9e  Popover.tsx
9ec9037da6dd744270561fc4b4d35d92cc9ae0128cac7fbbe3031557beb48f1b  Progress.tsx
185d57bee798e27cfe7df1c353462f94fb71c82072a3457c886dd667af5741ac  Select.tsx
a4ee8616d3758facd94833e205a1889dff639ae90eb08bfc6d71eca626949368  Skeleton.tsx
ef0253bdb70f933f1f723e0f0f6a712dc890fcdaa1ec0d224269c7f6f6890d09  Slider.tsx
8907282cccd835ee4c7f6894cfe587061525b41e4c9e6dfb939c380365c98af1  Spinner.tsx
87d61764e32a582bcfd4668cd478b3ee1c4ff93c8caff4c85cd8b412f7259172  Swap.tsx
81905a1bf2d381d16785191c7e18ff00f5f5dc94cb57945131cab7768c2938b6  Tabs.tsx
438f2bb18f254e150daccd70f5484c4e362ba14b507fc9b78e56c279da557561  Text.tsx
f089c2e93a299c2d13c2b93447ad8975addddaf2b11d82032b813657b1e12a6c  TextField.tsx
1c1dc9a09debf7421fb5e9e473faf9cd58e3051b85471f796a83053e7f099fa3  Toast.tsx
e3c71b57f68374991df69fa84c13d4f4df0bc422edb28832c63884c1aa24b77a  audio.tsx
0a4c24854d23613bc70c27408a37107bc37a97325a936c11c6fa5c13a0ec04c9  blur.tsx
953874bab9ad7843f1323e84125c5313b5b3ea4ba9b61bf9647f16e407fe6085  controls.tsx
9d1ba70965508bd0e99ec47c5128e6646ac7aa1b15d78908d81b6a9ea7a49220  generated/tokens.ts
c9cf0dd9f969ca8666377f6e5c3206c2840bb742a9f0e20658f8681fbe5bc831  icon.tsx
da77c50b066cb7be8ea93da270a2df5487819bd4b6c25db4e615c1f9c9da9c33  index.ts
c7545a6a00520b736372e12bf105c66b5978174400d2503af441ca1454e4e0e0  layout.tsx
d6a2665e30dedc99e1318fae80dd4fc457580901c3a28a0d95db78b49db4a45a  motion.ts
46cc49f23979029201c7e1a0297e7033f82526ef1e709721881b79512bc42095  overlay.tsx
d73646692c57df2c7ce8c5117190fb68b143506915da5cfcf1eaff88b94ebc65  pending.tsx
cbb7068dc13cc3035d1479a1be630356c622ce64f7c403f80205e81b06a74a89  presence.tsx
98d3dcc03967f5a4c0f201252bb8c5ac012739a4a7b4b6489ecadfcb9ea7ced5  press.ts
4db05b6f7805d678e6ba007d02d7f3c4a71efc21bf3c4c42629dc46588e0978b  screen.tsx
fdf47227c73049951b33247c763fb78b2dfaa81e43b3beb2896a280db780da6b  theme.tsx
```
