# Registro de cambios para auditoría

## Alcance y estado

- Proyecto: Trama DTF (`/Users/cristianpizarro/Desktop/Proyectos IA/DTF`).
- Commit base visible: `7bc0b7f` — `Add Trama DTF editor and gang sheet tools` — 2026-09-07 11:52 (-03:00).
- Este registro se preparó inicialmente sobre cambios sin commit; la publicación posterior agrupa esos cambios y la configuración de GitHub Pages. Consultar el historial Git para identificar el commit publicado.
- Archivos modificados: `README.md`, `src/App.tsx`, `src/GangSheet.tsx`, `src/halftone.ts`, `src/halftone.worker.ts`, `src/packing.ts`, `src/styles.css` y sus pruebas.
- Archivos nuevos: `src/auto-adjust.ts` y `src/auto-adjust.test.ts`.
- Actualización posterior: también `src/CropPanel.tsx`, `src/crop.ts`, `src/history.ts` y sus pruebas; se modificaron `src/print.ts` y `src/print.test.ts`. El historial Git disponible no permite atribuir cada modificación a «ayer» u «hoy» con certeza.

## Cambios funcionales

### Puerta de acceso para GitHub Pages — 2026-09-09, local y publicada

- Se añadió una pantalla de acceso antes de montar el editor: usuario `viborasnake@gmail.com` y contraseña verificada con SHA-256. La sesión se conserva solo en `sessionStorage` de la pestaña.
- La contraseña en texto plano no se guarda en el repositorio ni en el navegador. El hash dentro de un frontend estático solo disuade el acceso casual; no constituye control de acceso de servidor porque el código publicado puede inspeccionarse y modificarse.
- Se incorporó al build de GitHub Pages y se verificó con pruebas y compilación. Para privacidad real del sitio se requiere autenticación en servidor o una capa como Cloudflare Access/GitHub Enterprise.

### Cinco presets de semitono por tono de prenda — 2026-09-08, local

- Se mantienen los tres presets de semitono existentes de cada tono, con sus identificadores y valores. Se añaden «Trama marcada» (24 LPI, cobertura neutra) y «Reducir ruido» (45 LPI, limpieza de fondo al 35%) tanto para prenda oscura como clara. Los nuevos presets claros usan detalle 0%.
- Las descripciones explican el uso: patrón visible o reducción de pintitas próximas al fondo, incluyendo el efecto sobre detalles reales cercanos al negro/blanco. Son ajustes iniciales editables.
- El selector muestra cinco opciones de semitono por tono; «Sin semitono» conserva sus tres opciones. La biblioteca personalizada y los ajustes de los proyectos existentes se mantienen. Los presets no modifican dimensiones, ppp, recorte ni bordes.
- Verificación: 77 pruebas y build aprobados; `git diff --check` sin errores. La prueba del catálogo comprueba cinco opciones por tono, una monocromática, y los controles preservados; las regresiones existentes cubren limpieza, cambio de categoría y biblioteca personalizada. Sin despliegue.

### Corrección de cobertura tonal sobre blanco — 2026-09-08, local

- Causa del aspecto de fotografía perforada: `coverage + (1 - coverage) * whiteDetail` imponía al menos 90% de cobertura para todo tono no eliminado con detalle 90%.
- Se sustituye por `coverage + coverage * (1 - coverage) * whiteDetail`: mantiene extremos 0/1 y variación tonal incluso con detalle 100%. Se conserva la compensación cromática sobre blanco; no cambia el algoritmo negro. Afecta también al gotero con base blanca.
- Presets claros: «Trama tonal» (32 LPI, detalle 0%) y «Trama fina» (45 LPI, detalle 30%) reemplazan las configuraciones de detalle 70/90%. Se actualizan ayudas y se retira un párrafo duplicado de «Conservar color».
- Compatibilidad: valores de proyectos/presets personalizados no se sobreescriben, pero al reprocesarlos la nueva curva cambia su resultado blanco. Los PNG exportados y assets ya rasterizados del Gang Sheet requieren regeneración/actualización desde el editor para reflejarla. DPI, dimensiones y perfiles no se modifican.
- Verificación: 77 pruebas aprobadas. Nueva regresión de cobertura de seis tonos, tres formas y 150/300/600 ppp, con detalle 0/30/90/100%; se mantienen pruebas de promedio cromático, máscara del gotero y aislamiento del modo negro. No constituye validación física de impresión ni comparación con el archivo fuente de la captura.
- Build y `git diff --check` aprobados. Chromium aislado: importación de seis bandas grises, aplicación de ambos presets y detalle 90%, lectura del alfa del canvas y captura revisada, sin errores JavaScript. Cobertura de gris 230: 9,8% en Trama tonal y 17,7% con detalle 90%; gris 128: 49,8% y 72,3%, respectivamente. Sin modificar el proyecto del usuario ni desplegar.

### Eliminar proyecto y organización de cabecera — 2026-09-08, local

- Cabecera de proyecto colapsable, cerrada al iniciar: el nombre con flecha abre/cierra el peso, ubicación, archivo actual y barra de acciones de proyecto. Nombre, estado de guardado y exportación siguen visibles. El botón expone su estado y controla ambas zonas con ARIA; el espacio liberado se asigna al área de trabajo.

- «Nuevo proyecto» se reemplaza por «Eliminar proyecto y empezar de cero», con icono de papelera y confirmación que identifica el proyecto y el alcance. Elimina la entrada activa en IndexedDB y las tres claves heredadas del proyecto; vuelve a la pantalla de nombre. Conserva biblioteca de presets y archivos descargados. La interfaz queda inactiva durante el borrado y se informa si falla.
- Abrir, Descargar y Eliminar quedan agrupados en una barra de Proyecto; Enviar/Actualizar Gang Sheet y Exportar PNG permanecen en la cabecera. Restablecer ajustes conserva su acción independiente.
- El área de trabajo usa el espacio restante de la ventana en lugar de descontar una altura fija, para admitir la barra nueva y su adaptación a pantallas estrechas.
- Build y tres pruebas de reinicio/estructura de proyecto aprobados. No se borró el proyecto real del usuario ni se publicó en GitHub.
- Prueba en Chromium aislado aprobada: cancelar conserva el proyecto, confirmar vuelve al inicio, recargar no restaura el proyecto eliminado, se puede crear uno nuevo, se conserva almacenamiento ajeno y el área de trabajo cabe en la ventana.
- Cabecera con peso del JSON completo en KB/MB (incluye imágenes, medido en UTF-8 tras el guardado) y ubicación «Este navegador» con el host actual. No se presenta como espacio físico exacto ocupado por IndexedDB ni se inventa una ruta de Descargas.

### Rango de color con gotero — 2026-09-08, solo local

- Añadidos `src/color-range.ts`, `src/ColorRangePanel.tsx` y pruebas: hasta ocho muestras del original con recorte vigente, reemplazar/añadir/eliminar muestra, color editable, tolerancia y suavidad 0–100%, máscara en vivo y previsualización del recorte. Aplicar/Cancelar, Escape y foco contenido en el diálogo.
- Nuevo modo `custom`, compatible con Negro/Blanco/Ninguno sin cambiar sus algoritmos. Distancia máxima por canal RGB; no se promete equivalencia con Photoshop. Selección global, no semántica ni limitada a zonas conectadas al borde.
- Worker pasa los píxeles remuestreados sin corrección para calcular la máscara. Los colores seleccionados no reaparecen con correcciones, nitidez, Conservar detalle, inversión o densidad; la máscara multiplica cobertura al final. Interior no seleccionado conserva color; con ajustes neutros y tamaño 100%, solo se traman transparencias/transiciones. No realiza descontaminación de color de bordes.
- Configuración opcional validada en proyectos/presets y conservada por historial/autoguardado/documentos editables. 76 pruebas y build aprobados; regresiones incluyen PNG RGBA, colores fuera del rango, eliminación a 150/300/600 ppp, configuraciones inválidas y ausencia de efectos del campo nuevo en modos anteriores. No se publicó ni se hizo push.
- El selector manual «Dónde quitar blanco» se retiró de la interfaz: el flujo visible queda en Blanco/Negro o Gotero · Rango de color. `whiteRemoval:'connected'` se conserva internamente para compatibilidad y para el preset continuo de quitar fondo blanco, sin exponer dos mecanismos superpuestos al usuario.
- «Recortar al contenido» ahora también puede leer el alfa del resultado procesado (incluido el fondo quitado por el gotero) cuando el original es opaco. Solo calcula un rectángulo y vuelve a renderizar los píxeles originales; no convierte bordes en transparencia. Si no hay alfa recortable, muestra el motivo dentro del panel.
- Las intensidades de Tono automático, Contraste automático y Color automático se reubicaron inmediatamente debajo de su botón correspondiente. Los ajustes generales permanecen agrupados dentro de «Ajustes avanzados de imagen».
- «Alfa sólido (DTF)» se movió desde los ajustes avanzados al panel colapsable «Semitono», junto a tamaño y forma del punto, porque controla la opacidad de los puntos exportados.
- «Conservar color» e «Invertir trama» se reubicaron también dentro de «Semitono»: ambos modifican directamente el color/polaridad de la tinta tramada. Las correcciones fotográficas permanecen en «Ajustes avanzados de imagen».
- El botón «Gotero · Rango de color…» ahora incluye el icono `Pipette` y conserva una etiqueta accesible/textual para identificar la herramienta.

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

- «Un color» local (2026-09-08): añadido a las cuatro combinaciones de prenda/acabado; cada grupo ahora tiene tres presets (12 incluidos). Tinta blanca y eliminación de negro para prenda oscura; tinta negra y eliminación global de blanco para clara. Semitono a 45 LPI con alfa sólido; sin trama usa alfa parcial para conservar transiciones. Implementado con `preserveColor:false` y valores neutros explícitos, sin modificar el algoritmo ni los presets a color. No equivale a limpiar ruido cromático selectivamente: convierte todos los colores del diseño. Prueba nueva con residuos rojo/azul, grises y transparencia a 150/300/600 ppp y ambos acabados, sin píxeles cromáticos en la salida.
- Proyecto con nombre y autoguardado integral local (2026-09-08): al no existir proyecto activo se pide nombre o abrir `.trama.json`; se persiste antes de comenzar. IndexedDB reemplaza el guardado fragmentado en localStorage para el proyecto activo e incluye originales, editor, ajustes, crop, DPI, categoría de prenda y Gang Sheet. Se recupera al iniciar; los guardados antiguos de plancha se incorporan al crear el proyecto. Escrituras diferidas 500 ms y serializadas, confirmación solo al completar la transacción, advertencia al salir con cambios pendientes y caché de originales/canvases serializados. No sobrescribe archivos del disco; «Descargar proyecto» y «Abrir proyecto» están en la cabecera. El almacenamiento depende del navegador/origen y puede borrarse; no reemplaza una copia externa. Si falla la lectura inicial no se permite sobrescribir. Nuevo proyecto exige confirmación y conserva presets/descargas.
- Biblioteca personal: renombrar conserva ID y ajustes, rechaza nombres vacíos/duplicados; eliminar requiere confirmación, afecta solo el preset seleccionado y conserva los ajustes de la imagen actual. Controles contextuales: panel de trama oculto sin semitono, intensidades visibles solo al activar la corrección, escala por porcentaje y ajustes menos frecuentes bajo desplegables; retirados del UI los accesos duplicados al preset blanco y al interruptor de acabado. No se eliminan las capacidades del motor. Categoría de prenda opcional en documentos/presets para recuperar correctamente «Color original» sin fondo.
- Verificación: 63 pruebas y build aprobados. Chromium aislado probó nombre inicial, autoguardado y recarga de editor a 150 ppp/5 cm, diseños y originales del Gang Sheet, descarga/reapertura de `.trama.json`, renombrar/eliminar, controles contextuales y categoría clara. Fallo de escritura simulado: aviso visible, registro anterior intacto; al recuperarse el almacenamiento se guardó el cambio siguiente. Sin errores JS. No se garantiza conservación ante borrado de datos del navegador o cierre antes de confirmar guardado. Sin publicación.
- Reorganización local (2026-09-08): sustituida la lista plana de presets incluidos por Prenda oscura / Prenda clara → Semitono / Sin semitono → dos presets por combinación (8 en total). Oscura: Equilibrado / Trama fina; Color original / Quitar negro. Clara: Detalle suave / Máximo detalle; Color original / Quitar fondo blanco. Cambiar de grupo aplica la primera opción y sincroniza Resultado y fondo de referencia. Los valores de procesamiento son explícitos para evitar heredar gamma, color, enfoque, alfa o eliminación de fondo del preset anterior; no alteran tamaño, DPI, crop ni bordes. Inicio y restablecimiento usan Equilibrado (32 LPI, tamaño 100%, tolerancia 0, ajustes neutros); no se reescriben documentos existentes. La biblioteca personal se conserva. «Color original» conserva alfa y color, sujeto al recorte/bordes elegidos; «Quitar negro» usa alfa parcial y afecta negros interiores. Negro/blanco son referencias, no perfiles para cualquier color de tela. Catálogo centralizado en `src/garment-presets.ts`; la recomendación blanca usa los mismos valores. 60 pruebas y build aprobados; Chromium aislado verificó las ocho selecciones, sus grupos, render y guardado/reaplicación de preset personal sin errores JS. Sin deploy ni push.
- «Nuevo proyecto» en la cabecera, disponible en ambas pestañas: confirmación explícita antes de vaciar editor, plancha, historial y configuración de la sesión. Elimina únicamente las tres claves del proyecto activo en localStorage, conserva presets y archivos descargados y remonta la sesión para cancelar el procesamiento anterior. «Restablecer ajustes» sigue siendo una operación distinta, limitada a los ajustes del editor. Dos pruebas de limpieza selectiva y error de almacenamiento; total 47 pruebas y build aprobados. Pendiente comprobación visual en navegador.
- Guardar/Abrir proyecto en Gang Sheet: archivo portable `.trama.json` versionado, con imágenes procesadas, originales rasterizados disponibles, ajustes/crop por diseño, borrador actual del editor, tamaño/ppp/copias, configuración de plancha y fondo de vista. No depende de localStorage; no incluye archivos tipográficos, fuentes vectoriales originales, biblioteca de presets ni historial de deshacer. Los archivos antiguos sin original siguen sin poder recuperar ese original. Abrir pide confirmación, valida estructura y decodifica imágenes antes de sustituir el trabajo; no recuerda una aceptación previa de reescalado. Límite de apertura: 1 GB, compartido por editor y Gang Sheet para evitar bloqueos por archivos excesivos. Tres pruebas nuevas de formato/validación; 45 pruebas y build aprobados. Pendiente prueba integral de descarga/reapertura en navegador.
- Se mantuvieron Default, Nitidez, Full Gradients y Best Value.
- Se agregaron Monocolor, Prenda negra, Prenda blanca, Foto/degradados, Transparencia alta, Ahorro de tinta y Borde suave.
- Se añadió guardado de presets con nombre, validación de rangos y sufijo para nombres repetidos. La migración completa campos nuevos ausentes antes de validar; conserva valores explícitos como cero y false y no corrige silenciosamente valores inválidos.
- Se guardan localmente el nombre del proyecto Gang Sheet, sus dimensiones, DPI, separación, rotación y diseños importados.

### Trama, transparencia y bordes

- Prueba de navegador de limpieza: fixture SVG con cuatro bandas (residuo casi negro, residuo casi blanco, rojo y azul). A 100% las bandas residuales pasaron de 381/23.050 píxeles impresos a cero en sus respectivos modos; bandas roja y azul idénticas píxel a píxel. Recarga recuperó intensidad 100 y exportación PNG completada, sin errores JS. Es evidencia sintética, no una comparación con el archivo original del usuario ni una prueba física de impresión.
- Limpieza local de ruido junto al fondo (2026-09-08): campo opcional `backgroundCleanup` 0–100, ausente/0 conserva salida anterior. Control contextual en semitono full color con fondo negro («Limpiar ruido en sombras») o blanco global («Limpiar ruido en blancos»), apagado en todos los presets incluidos. En negro toma el máximo RGB como distancia al negro; en blanco, 1−mínimo RGB como distancia al blanco. Atenúa cobertura y limita la amplificación RGB con transición smoothstep entre 8 y 48 niveles de 255; a intensidad máxima elimina residuos a distancia ≤8 y deja intacta la rama fuera de 48. La compensación blanca ocurre después de `whiteDetail`, para que no rellene la cobertura eliminada; aproxima RGB al blanco, no al negro. No actúa en monocolor, sin trama, fondo ninguno ni blanco conectado. Conserva transparencias y guarda/valida intensidad en presets, documentos, autoguardado y proyecto portable. Puede perder detalle real próximo al fondo: no es un detector semántico de ruido. Se añadieron seis pruebas: compatibilidad a 0, residuos en ambos fondos a 150/300/600 ppp, intensidad progresiva, colores fuera de zona invariantes, modos excluidos y persistencia/validación. 70 pruebas y build aprobados; sin deploy.
- Control local «Conservar detalle» (2026-09-08): 0–100%, exclusivo de semitono en color con eliminación global de blanco. Interpola cobertura hacia 1 y compensa RGB con la razón entre cobertura previa y nueva, preservando la composición sobre blanco con ajustes neutros. 0% mantiene la trama anterior; 70% es el inicio del preset «Prenda blanca · detalle suave»; 100% conserva color continuo en píxeles no eliminados por el umbral. Incrementa la superficie impresa. Campo opcional `whiteDetail` guardado en presets/documentos/proyectos, validado de 0 a 100; ausencia equivale a 0. No modifica negro, eliminación conectada ni modo sin trama. Pruebas de líneas finas: a 70% menos de la mitad de píxeles perdidos/error cuadrático que a 0%; 100% conserva exactamente los colores opacos interiores. Se verifica tono medio a varias intensidades e invariancia de los demás modos. 56 pruebas y build aprobados. Cambios solo locales por indicación del usuario.
- Verificación del control en Chromium local aislado: importar SVG sintético de gris 128, aplicar preset, mover deslizador 70→0→100 y exportar PNG. En una región de 384×384 px: huecos 22.214/74.029/0 respectivamente; gris medio compuesto sobre blanco 127,60/128,02/128. PNG exportado idéntico píxel por píxel al canvas de resultado, sin errores de navegador. Deslizadores con nombre accesible explícito (`aria-label`). Esta prueba no equivale a una prueba física DTF ni valida el archivo original del perro, no disponible como fuente en esta comprobación.
- Corrección posterior al preset blanco (2026-09-08): el modo conectado conservaba cobertura interior 1, por lo que el preset a tamaño 100% no generaba puntos interiores. Se reemplaza la recomendación por «Prenda blanca · semitono» (global, umbral 255, 32 LPI, cobertura neutra, alfa sólido), y el recorte conectado se ofrece como «Quitar fondo blanco · sin semitono». El botón también selecciona Resultado y vista blanca. Se elimina el aviso que atribuía oscuridad a LPI altos por sí solos.
- Corrección del muestreo de alfa sólido: antes bastaba un acierto entre cuatro muestras para marcar el píxel entero opaco, engordando los puntos. Ahora se evalúa el centro del píxel en alfa sólido; alfa parcial conserva cuatro muestras. En una referencia gris 128 a 65 LPI/300 ppp el promedio anterior sobre blanco era 81,14; la nueva prueba de navegador a 32 LPI da 128,02. El cambio afecta a la rasterización sólida de todos los modos, incluidos proyectos anteriores regenerados; los PNG existentes no se modifican.
- Verificación de esta corrección: 53 pruebas aprobadas y build correcto. Nuevas pruebas de tono medio con gris, marrón, rojo, crema y rosa, 150/300/600 ppp, 32/65 LPI y comparación sólido/parcial para círculo/cuadrado/línea. Prueba en Chromium aislado: cargar SVG sintético, aplicar el botón, comprobar modo global, puntos/huecos binarios, media tonal y descarga PNG; sin errores JS. No se ha comparado con el archivo original del perro ni con impresión física.
- Revisión para prenda blanca (2026-09-08): el preset anterior reducía cobertura con tamaño de punto 94% y retiraba blancos globalmente. «Prenda blanca · conservar detalle» usa tamaño 100%, ajustes neutros, alfa parcial y correcciones automáticas apagadas; selecciona vista blanca y eliminación de claros conectados al borde. Un recorrido desde el perímetro conserva zonas claras encerradas y colores interiores. El modo global sigue disponible como «Todos los blancos · trama sobre blanco»; proyectos/presets anteriores sin `whiteRemoval` conservan ese comportamiento. Los detalles claros conectados al exterior pueden eliminarse; no es segmentación del sujeto. Tres pruebas adicionales comprueban conservación exacta de colores interiores opacos, umbral y márgenes transparentes: 51 pruebas aprobadas y build correcto. No se dispone del archivo original del perro para comparación directa.
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
