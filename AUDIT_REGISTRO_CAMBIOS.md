# Registro de cambios para auditoría

## Alcance y estado

- Proyecto: Trama DTF (`/Users/cristianpizarro/Desktop/Proyectos IA/DTF`).
- Commit base visible: `7bc0b7f` — `Add Trama DTF editor and gang sheet tools` — 2026-09-07 11:52 (-03:00).
- Este registro se preparó inicialmente sobre cambios sin commit; la publicación posterior agrupa esos cambios y la configuración de GitHub Pages. Consultar el historial Git para identificar el commit publicado.
- Archivos modificados: `README.md`, `src/App.tsx`, `src/GangSheet.tsx`, `src/halftone.ts`, `src/halftone.worker.ts`, `src/packing.ts`, `src/styles.css` y sus pruebas.
- Archivos nuevos: `src/auto-adjust.ts` y `src/auto-adjust.test.ts`.
- Actualización posterior: también `src/CropPanel.tsx`, `src/crop.ts`, `src/history.ts` y sus pruebas; se modificaron `src/print.ts` y `src/print.test.ts`. El historial Git disponible no permite atribuir cada modificación a «ayer» u «hoy» con certeza.

## Cambios funcionales

### Flujo de importación y edición

- El diálogo previo de importación fue eliminado a petición del usuario. La imagen abre directamente en el editor, donde se ajustan tamaño, ppp, escala, nitidez y color.
- El tamaño físico se calcula usando píxeles, escala y DPI; el alto queda bloqueado a la proporción original.
- La vista de detalle del diálogo fue retirada junto con él; se utiliza el zoom y la comparación del editor.
- Se incorporaron controles de color de prenda/fondo de previsualización y preparación antes de enviar al editor.
- Se añadió la posibilidad de volver a editar un diseño desde Gang Sheet antes de colocarlo nuevamente.
- Se añadió mano/paneo y zoom. El inicio actual es el editor vacío con aviso de arrastrar o abrir imagen, sin demo. Los proyectos Gang Sheet guardados siguen disponibles en su pestaña.
- Crop manual reversible y recorte automático de márgenes transparentes del original. Detecta cualquier alfa mayor que cero, conserva huecos internos y reduce el tamaño físico proporcionalmente. No elimina fondos opacos.

### Correcciones automáticas y color

- Nuevo módulo `src/auto-adjust.ts` con correcciones no destructivas y derivadas siempre del original:
  - Tono automático por canal mediante expansión tonal.
  - Contraste automático con rango común para conservar el color.
  - Color automático basado en tonos neutros de medios tonos.
  - Intensidad independiente de 0 a 100% para tono, contraste y color.
  - Temperatura y tinte manuales para balance de blancos.
- Las correcciones se ejecutan antes de la trama en el worker y se reflejan en las vistas previas.
- Las correcciones pueden combinarse, desactivarse y guardarse dentro de presets.

### Presets y persistencia

- «Nuevo proyecto» en la cabecera, disponible en ambas pestañas: confirmación explícita antes de vaciar editor, plancha, historial y configuración de la sesión. Elimina únicamente las tres claves del proyecto activo en localStorage, conserva presets y archivos descargados y remonta la sesión para cancelar el procesamiento anterior. «Restablecer ajustes» sigue siendo una operación distinta, limitada a los ajustes del editor. Dos pruebas de limpieza selectiva y error de almacenamiento; total 47 pruebas y build aprobados. Pendiente comprobación visual en navegador.
- Guardar/Abrir proyecto en Gang Sheet: archivo portable `.trama.json` versionado, con imágenes procesadas, originales rasterizados disponibles, ajustes/crop por diseño, borrador actual del editor, tamaño/ppp/copias, configuración de plancha y fondo de vista. No depende de localStorage; no incluye archivos tipográficos, fuentes vectoriales originales, biblioteca de presets ni historial de deshacer. Los archivos antiguos sin original siguen sin poder recuperar ese original. Abrir pide confirmación, valida estructura y decodifica imágenes antes de sustituir el trabajo; no recuerda una aceptación previa de reescalado. Límite de apertura: 350 MB. Tres pruebas nuevas de formato/validación; 45 pruebas y build aprobados. Pendiente prueba integral de descarga/reapertura en navegador.
- Se mantuvieron Default, Nitidez, Full Gradients y Best Value.
- Se agregaron Monocolor, Prenda negra, Prenda blanca, Foto/degradados, Transparencia alta, Ahorro de tinta y Borde suave.
- Se añadió guardado de presets con nombre, validación de rangos y sufijo para nombres repetidos. La migración completa campos nuevos ausentes antes de validar; conserva valores explícitos como cero y false y no corrige silenciosamente valores inválidos.
- Se guardan localmente el nombre del proyecto Gang Sheet, sus dimensiones, DPI, separación, rotación y diseños importados.

### Trama, transparencia y bordes

- Control `Alfa sólido (DTF)`: activado explícitamente produce alfa binario incluso con originales parcialmente transparentes, con trama activada o desactivada. Los píxeles vacíos siguen transparentes; desactivarlo permite cobertura parcial.
- Se agregó radio de esquinas en milímetros, además de margen, desvanecido y selección de lados. Se corrigieron los cortes cuadrados: una única máscara final calcula el redondeado desde los centros de píxel sobre los límites del contenido resultante, con radio limitado a la mitad de sus dimensiones. Las pruebas cubren simetría, radios extremos, imagen vacía y porcentaje de transparencia.
- Se reforzó la nitidez adicional; la nitidez se aplica antes de generar la trama.
- El worker usa el mismo pipeline de ajustes automáticos y trama que la vista principal.
- Se retiró del Gang Sheet la conversión forzada de alfa no nulo a 255: ahora respeta la cobertura recibida del editor. Exporta en coordenadas enteras y sin suavizado de imagen para evitar interpolación accidental en la colocación.

### Gang Sheet y exportación

- Selección de diseños por clic en la plancha, selector y tarjetas; contorno de selección solo en preview. Doble clic o «Editar seleccionado» recupera el documento original disponible; al actualizar se conserva el elemento y sus copias. Seleccionar una copia selecciona el asset compartido. Diseños sin documento muestran un aviso, sin retramar automáticamente el PNG.
- «Corregir resolución sin remuestrear»: usa una resolución común compatible si existe; si no, propone cambiar los centímetros de los diseños a sus píxeles nativos / ppp de plancha. Muestra medidas antes/después y requiere confirmación. No conserva necesariamente el tamaño físico ni garantiza que todas las copias sigan cabiendo; no altera los píxeles ni acepta silenciosamente reescalado.
- Zoom de vista previa: acercar/alejar, porcentaje, 100% (un píxel de salida por píxel de vista) y ajuste completo a la ventana. Desplazamiento horizontal/vertical y renderizado limitado al área visible para evitar un canvas del tamaño total al ampliar. No modifica dimensiones, ppp ni exportación. Implementado en `src/GangPreview.tsx`; build y 42 pruebas existentes aprobados, pendiente validación visual del nuevo control en navegador.
- Se añadieron presets de plancha: 58×100, 58×50, 58×30, 40×60 y 30×30 cm.
- Se añadieron nombre del trabajo, resolución, separación/margen, giro de 90°, estado de guardado local y fondos de previsualización (transparencia, negro, blanco, gris, azul marino y rojo).
- El fondo de prenda es exclusivamente de vista previa y no se exporta.
- Se añadieron botones para importar y ajustar, añadir PNG/imágenes directamente, editar antes de Gang Sheet y exportar Gang Sheet.
- El algoritmo de distribución compara 24 combinaciones deterministas de orden y estrategia, intenta reutilizar huecos laterales, respeta separación y rotación, y prioriza colocar el mayor número de copias con menor altura ocupada.
- Se corrigió el cálculo de margen interior para no duplicar el espacio del borde derecho/inferior y se corrigió la eliminación de rectángulos libres equivalentes.
- El mensaje de distribución ahora explica que se aprovechan los huecos y que la rotación amplía las alternativas.

### UI y disposición

- El panel del editor se reorganizó como flujo numerado y, en pantallas amplias, en dos columnas.
- Se ajustaron alturas, desbordamiento, scroll, radios, espaciado y reglas responsive para que las tarjetas puedan mostrar todo su contenido.
- Se añadieron estilos para los controles automáticos, modal de importación, presets de plancha, fondo de preview, indicador de guardado y tarjetas de assets.
- Las seis tarjetas son colapsables y se ordenan 1–2 / 3–4 / 5–6 (una columna en móviles estrechos). Pre-prensa completo también se puede ocultar. «Vista sobre» comparte barra con Original/Comparar/Resultado y Deshacer/Rehacer.
- Se conserva el último resultado mientras se procesa; el canvas se actualiza cuando llega el nuevo resultado. Historial de hasta 50 cambios por imagen, agrupación por gesto y atajos de deshacer/rehacer; incluye ajustes, tamaño y crop. No cubre las operaciones del Gang Sheet.

## Coherencia de resolución y perfil: revisión aplicada

- Editor: 150/300/600 ppp; 300 ppp por defecto. PNG importados con metadatos simétricos de esas resoluciones se reconocen (tolerancia 0,02 ppp). Otros valores o formatos utilizan 300 ppp; se debe revisar el tamaño físico.
- Editor → Gang Sheet: conserva dimensiones efectivas en cm y PNG con ppp explícitos y etiqueta sRGB. No se cambia automáticamente una plancha que ya contiene diseños.
- Se calcula la resolución efectiva de cada diseño desde sus píxeles y cm actuales, también al restaurar proyectos. La compatibilidad requiere coincidencia exacta de ancho y alto en píxeles de salida, no solo de una etiqueta DPI.
- Si un diseño necesitaría reescalado, se muestra su resolución efectiva frente a la de la plancha y se bloquea exportar. El usuario puede corregir tamaño/ppp o aceptar explícitamente el reescalado. La aceptación queda invalidada al cambiar resolución o geometría/conjunto de diseños.
- «Igualar plancha a … ppp» aparece cuando todos los diseños pueden colocarse a 150, 300 o 600 ppp conservando sus dimensiones en píxeles. En planchas mixtas no hay necesariamente un valor que conserve todos los diseños.
- Exportación: posiciones enteras y dimensiones de cada diseño calculadas con los ppp exactos de la plancha; se evita escalar por el cociente de dimensiones globales redondeadas. Se verifican píxeles, ppp X/Y y etiqueta sRGB del PNG.
- Los nuevos envíos al Gang Sheet incluyen un documento editable con original rasterizado sin trama, ajustes, crop, tamaño físico y ppp. «Editar original» recupera ese documento; «Actualizar en Gang Sheet» reemplaza el mismo elemento conservando sus copias. No se genera otra trama sobre el PNG procesado. Los diseños antiguos o importados directamente sin documento muestran un aviso para importar el original: no es posible reconstruir los ajustes perdidos.
- El original guardado es una rasterización sRGB de 8 bits anterior al procesamiento, no los bytes del archivo fuente: no conserva vectores, profundidad de 16 bits ni el perfil ICC original. Guardarlo aumenta el consumo de almacenamiento local; ante falta de espacio se muestra «No guardado» y un aviso de mantener la pestaña abierta.
- Color: salida RGB/RGBA sRGB, 8 bits por canal. Los PNG generados por canvas reciben una etiqueta estándar sRGB; se retiran etiquetas de color potencialmente contradictorias sin modificar IDAT. Esto no es una conversión ICC para una impresora concreta ni una exportación CMYK. La conversión al perfil de tinta/film/impresora corresponde al RIP.
- No hay resolución universal óptima: aumentar de 150 a 600 ppp no reconstruye detalle. Conviene definir tamaño físico y resolución requerida por el RIP antes de generar el semitono. Reducir una trama ya generada puede perder puntos; ampliarla puede alterar su forma.
- Límites actuales: editor 40 MP / 12.000 px por lado; Gang Sheet 100 MP / 16.000 px por lado. Una plancha 58×100 cm a 600 ppp excede esos límites y no se exporta; no se reduce silenciosamente su resolución.
- Fuentes técnicas: [Canvas: espacio sRGB por defecto](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext), [especificación PNG: resolución y etiquetas de color](https://www.w3.org/TR/png-3/).

## Verificación realizada

- `npm test`: 42 pruebas aprobadas, 0 fallos, tras revisar resolución/perfil, esquinas, alfa sólido, presets antiguos y documentos editables.
- `npm run build`: compilación TypeScript y build Vite aprobados.
- `git diff --check`: sin errores de whitespace.
- Las pruebas cubren correcciones automáticas, transparencia alfa, bordes, DPI, escalado 200/300/400%, packing, márgenes, no solapamiento y copias que no caben.
- Nuevas pruebas: nueve combinaciones editor/plancha 150/300/600 ppp, discrepancias por tamaño, dimensiones redondeadas compatibles, etiqueta sRGB única, eliminación de etiqueta ICC contradictoria y conservación de bytes de píxeles al etiquetar. Incluye también crop e historial. No equivale a validación de impresión física ni prueba integral de todos los navegadores.
- Última revisión: siete pruebas adicionales sobre esquinas, alfa parcial, migración de presets y serialización/actualización de documentos sin duplicar diseños ni perder copias. Nuevos módulos: `src/preset-migration.ts`, `src/editor-document.ts` y sus pruebas. La recuperación tras recargar y el flujo completo de reedición aún requieren prueba manual en navegador; la serialización está cubierta por pruebas unitarias.

## Puntos para auditoría posterior

- Para auditar, comparar el código publicado con `7bc0b7f` y revisar también cualquier cambio posterior del árbol de trabajo.
- La distribución es heurística determinista (24 candidatos), no un solucionador matemático óptimo para todos los casos.
- El almacenamiento local depende de la capacidad del navegador; si falla, la sesión actual continúa pero no se garantiza persistencia.
- Este registro documenta el código presente y las pruebas ejecutadas; no certifica todavía una validación visual exhaustiva en todos los tamaños de ventana ni una comparación física de impresión DTF.
