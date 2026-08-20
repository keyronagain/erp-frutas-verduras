# AGENTS.md

ERP de preventa por ciclos para un negocio de frutas/verduras (Costa Rica). No hay build, tests, ni framework: es una web estática + Google Sheets + Google Apps Script. No existe `package.json`, no hay lint/typecheck/CI.

## Arquitectura (3 piezas sueltas)

- `index.html` (raíz del repo) — formulario web de pedidos para clientes. Se despliega en Vercel. Contiene `SCRIPT_URL` hardcodeado; el catálogo y precios los carga dinámicamente desde `doGet`.
- `src/google-apps-script.js` — script que se pega en el editor de Apps Script del Sheets. Expone `doGet` (¿hay ciclo abierto? + catálogo) y `doPost` (recibe pedido).
- `src/ERP_Frutas_Verduras.xlsx` — plantilla de Google Sheets (9 pestañas: Catalogo, Ciclos, Pedidos, Lista de Compras, Sobrantes, Compras, Clientes, Gastos, Dashboard).

## Gotchas que un agente probablemente fallaría

- **La pestaña del catálogo se llama "Catalogo" SIN tilde** (no "Catálogo"). `getSheetByName('Catalogo')` con tilde devuelve `null`. Lo mismo aplica a los headers de esa hoja: `Producto`, `Unidad` y `Precio Venta (₡)`.
- **El catálogo/precios tienen una sola fuente de verdad**: la pestaña "Catalogo" del xlsx. `doGet` los lee y el form los renderiza; no duplicarlos en `index.html`.
- **`doPost` escribe filas por posición, no por header.** El array `fila` en `google-apps-script.js` debe coincidir EXACTAMENTE con el orden de columnas de la hoja "Pedidos" (#, Ciclo, Fecha Pedido, Producto, Tipo Cliente, Cantidad, Cliente, Dirección, Horario, Método Pago, Total (₡), Estado Entrega, Estado Pago). Agregar/quitar columnas en la hoja rompe el script silenciosamente.
- Un pedido con varios productos genera **una fila por producto**; el número `#` se incrementa por fila, no por pedido.
- `doPost` usa `LockService.getScriptLock()` para evitar colisiones al calcular el `#`. El `#` se calcula como el **máximo numérico** de la columna "#" (no la última fila), para ignorar filas de nota. No quitar el lock ni el `finally` que lo libera.
- `doPost` **valida contra el catálogo y recalcula el subtotal en el servidor** (no confía en lo que manda el cliente). Rechaza productos inexistentes o inactivos.
- La pestaña "Catalogo" puede tener una columna opcional **`Activo`** (Sí/No): `doGet` solo muestra los activos; `doPost` rechaza los inactivos. Sirve para retirar productos sin borrarlos (borrar rompería el `VLOOKUP` de "Total (₡)" en pedidos viejos).
- **"Fecha Pedido" se guarda como `Date` real** (no texto), para que el `MAXIFS` de "Última Compra" en "Clientes" ordene cronológicamente.
- `registrarCliente` hace upsert por `Nombre` en "Clientes" y **copia las fórmulas F/G** (`Total Compras`, `Última Compra`) de una fila existente, porque las tablas no auto-rellenan fórmulas al usar `appendRow`.
- **Las tablas del xlsx tienen rango fijo y NO se expanden solas con `appendRow`.** `Tbl_Catalogo` = `A1:I11` (10 productos), `Tbl_Clientes` = `A1:G6` (5 clientes), `Tbl_Pedidos` = `A1:M100` (100 filas). Agregar productos/clientes **fuera** de ese rango rompe el `VLOOKUP`/`SUMIF` (o los deja fuera del filtro). Para agregar, hacerlo **dentro** de la tabla (`Tab` en la última celda) o expandirla arrastrando la esquina.
- El formulario usa `mode: 'no-cors'` y `Content-Type: text/plain` (obligatorio para Apps Script). No quitar.
- `SCRIPT_URL` en `index.html` es la URL de despliegue de Apps Script (termina en `/exec`). Al **editar** el Apps Script hay que hacer "Nueva implementación" o la URL no refleja los cambios.
- Timezone fijo: `America/Costa_Rica`; moneda ₡ (CRC).

## Despliegue

- Vercel: estático, sin build. `vercel --prod`.
- **Docs desactualizadas:** `README.md` y `docs/GUIA.md` referencian `src/index.html` y "Root Directory = src", pero `index.html` vive en la **raíz del repo** (y `src/` solo tiene el xlsx y el script). Confiar en la estructura real, no en esos docs.

## Verificación

No hay tests automatizados. Verificación manual:
- `testFlujo()` en `google-apps-script.js` (ejecutar a mano desde el editor de Apps Script).
- Pasos de prueba en `docs/GUIA.md` (abrir/cerrar ciclo en la pestaña "Ciclos" → banner verde/rojo en el form).

## Convenciones

- Código y docs en español, con **tuteo** (no voseo) y **sin emojis**.
- Sin lint/formatter configurado; mantener el estilo existente.
