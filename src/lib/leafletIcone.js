// Ícone padrão do Leaflet servido pelo próprio build.
//
// Antes as três imagens vinham de unpkg.com em tempo de execução. Isso
// significa: o pino some se o CDN cair ou se o usuário estiver sem internet
// plena, há três requisições a um terceiro em toda visita, e a versão fixada
// na URL pode divergir da versão instalada no projeto.

import L from 'leaflet';
import iconeUrl from 'leaflet/dist/images/marker-icon.png';
import iconeRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import sombraUrl from 'leaflet/dist/images/marker-shadow.png';

let aplicado = false;

export function aplicarIconePadrao() {
  if (aplicado) return;
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl: iconeUrl,
    iconRetinaUrl: iconeRetinaUrl,
    shadowUrl: sombraUrl,
  });
  aplicado = true;
}
