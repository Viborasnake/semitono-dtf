# Trama DTF Lab

Aplicación web local para convertir diseños en semitonos listos para impresión DTF.

Aplicación publicada: https://viborasnake.github.io/semitono-dtf/

Cada push a `main` ejecuta pruebas, compila con la ruta base `/semitono-dtf/` y publica `dist` mediante GitHub Actions. Las imágenes y proyectos se procesan localmente en el navegador; no se suben al repositorio.

## Ejecutar

Requiere Node.js 24 y npm. El procesamiento de imágenes ocurre en el navegador; no necesita claves API ni backend.

```bash
git clone https://github.com/Viborasnake/semitono-dtf.git
cd semitono-dtf
npm ci
npm run dev
```

## Compilar

```bash
npm run build
```

## Funciones

- Carga de PNG, JPG, WebP y SVG por selector o arrastrando el archivo.
- Trama configurable por frecuencia (LPI), ángulo, forma y tamaño de punto.
- Eliminación de negro (prenda negra), blanco o sin eliminación de fondo.
- Ajustes de brillo, contraste y umbral de sombras/blancos.
- Resultado en color o monocromo, con opción de inversión.
- Comparación interactiva original/resultado.
- Exportación PNG con transparencia.
- Trama por píxel con suavizado de bordes, conservación de detalles y eliminación del color de fondo de los bordes.
- Vista sobre damero, prenda negra, blanca o gris; el fondo de vista previa no se incluye en el PNG.
- Escala manual en porcentaje y botones 100%, 200%, 300% y 400%.
- Ancho/alto en centímetros con proporciones bloqueadas; 150, 300 o 600 ppp.
- Ampliación Lanczos-3 con colores ponderados por alfa y nitidez adicional de 0 a 100%.
- Presets propios: Default, Nitidez, Full Gradients, Best Value, Monocolor, Prenda negra, Prenda blanca, Foto/degradados, Transparencia alta, Ahorro de tinta y Borde suave. Conservan tamaño, eliminación de fondo y bordes.
- Correcciones automáticas: Tono automático, Contraste automático y Color automático. Son reversibles, combinables y se calculan a partir del original antes de la trama.
- Flujo recomendado desde Gang Sheet: nombrar trabajo y escoger formato, importar para ajustar, enviar al Gang Sheet, repetir y exportar.
- Guardar preset con nombre: almacena los ajustes de trama, color, fondo, nitidez y bordes en este navegador. Aparecen en “Mis presets” al recargar. No incluye imagen, tamaño ni zoom; los nombres repetidos reciben un sufijo para conservar los anteriores.
- “Enviar a Gang Sheet” añade el resultado procesado a la plancha y la abre; el botón también está visible en pantallas pequeñas.
- Desvanecido y eliminación de margen en milímetros, por lado. Se aplican antes de generar la trama y no recortan el tamaño del archivo.
- Zoom independiente del tamaño de impresión, 100% real y Ajustar a pantalla, siempre accesibles.
- Herramienta Mano junto al zoom: arrastra para desplazarte por una imagen ampliada. Atajos: mantener Espacio o arrastrar con el botón central. Desactiva Mano para volver a arrastrar el divisor de comparación.
- Gang Sheet: diseños desde el editor o imágenes importadas, copias, tamaño proporcional, separación, margen, giro opcional y distribución automática por filas. No es un optimizador de anidado irregular.

Para un diseño con fondo negro, selecciona **Eliminar fondo → Negro**. Ajusta **Eliminar sombras** hasta quitar el fondo conservando los detalles. Esta operación afecta a los negros de toda la imagen, incluidos los del interior del dibujo. Revisa el resultado sobre una prenda negra y usa el damero para comprobar los huecos transparentes.

Para fondos blancos con detalles claros que quieras conservar, selecciona **Prenda blanca · conservar detalle**. El preset quita los tonos claros conectados al borde, conserva las zonas interiores y muestra el diseño sobre blanco. En **Dónde quitar blanco** puedes elegir eliminar todos los blancos para generar una trama que aproveche el blanco de la prenda. El umbral controla qué tonos se consideran fondo; si el pelaje claro conecta con el exterior, también puede eliminarse. La vista de prenda por sí sola no cambia el procesamiento.

Pruebas del motor:

```bash
npm test
```

## Tamaño y exportación

El tamaño se calcula como `píxeles = cm / 2,54 × ppp`, redondeado al píxel más cercano. El remuestreo ocurre **antes** del semitono, cuya frecuencia usa la resolución elegida. La exportación incluye un bloque PNG `pHYs` con esa resolución, reemplazando los 96 ppp habituales del canvas. Se validan dimensiones, resolución e integridad de los bloques del PNG antes de solicitar la descarga. El mensaje de confirmación indica las medidas verificadas; no confirma que el navegador haya guardado el archivo en disco. Algunos RIP ignoran los metadatos: comprobar allí los centímetros indicados.

No hay reducción silenciosa. El editor acepta salidas de hasta 40 megapíxeles y 12.000 px por lado; las planchas, 100 megapíxeles y 16.000 px por lado. Si se supera el límite, se muestra el motivo y se bloquea la exportación. El procesamiento de trama/remuestreo se ejecuta en un Web Worker cancelable.

La escala 200% duplica ancho y alto en píxeles (cuadruplica el área). La ampliación conserva y remuestrea el detalle disponible; no utiliza IA ni reproduce Photoshop Preserve Details 2.0, y no puede recuperar información ausente. Subir nitidez en exceso puede producir halos. Revisar al 100%.

En Gang Sheet, los diseños se colocan como imágenes rasterizadas. Cambiar allí el tamaño de un semitono ya generado cambia también su LPI efectivo; para mantener la frecuencia deseada, establecer primero el tamaño en el editor y añadir ese resultado a la plancha. Las imágenes importadas no reciben eliminación automática de fondo. Las copias que no caben bloquean la exportación para evitar omisiones.
