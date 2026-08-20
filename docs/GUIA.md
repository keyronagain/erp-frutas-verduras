# Guía: Modelo de Ciclos + Despliegue

## Cómo funciona

```
Flyer publicado
    ↓
Se abren pedidos (pestaña Ciclos: Estado = "Abierto")
    ↓
Cierre de pedidos (fecha/hora que definas)
    ↓
Revisar "Lista de Compras" → dice cuánto comprar de cada producto
    ↓
Ir a comprar → anotar en "Compras" lo real
    ↓
Entregar → marcar Estado Entrega en Pedidos
    ↓
Cobrar (SINPE/Efectivo) → marcar Estado Pago en Pedidos
    ↓
Llenar "Sobrantes" → ver si algo sirve para el próximo ciclo
```

**El cliente nunca ve nada de "ciclos".** Es 100% interno: el formulario detecta solo cuál ronda está abierta (`doGet` en el script) y le pone esa etiqueta al pedido (`doPost`).

## Pestañas del Excel

| Pestaña | Qué hace |
|---|---|
| Catalogo | Productos y precios (igual que antes) |
| **Ciclos** | Cada ronda: fechas, Estado |
| Pedidos | Ahora con columna Ciclo + Estado Entrega/Pago separados |
| **Lista de Compras** | Suma la demanda por producto + margen de seguridad 10% |
| Sobrantes | Reemplaza Inventario; lo que queda entre ciclos |
| Compras, Clientes, Gastos, Dashboard | Igual que antes, con fórmulas actualizadas |

## Puesta en marcha (checklist antes del primer ciclo)

1. Sube `ERP_Frutas_Verduras.xlsx` a Drive y ábrelo con Sheets (ver "Desplegar" abajo).
2. **Limpia los datos de ejemplo**: borra las filas de muestra de Pedidos, Clientes, Compras, Gastos, Sobrantes y Lista de Compras (y las filas de nota si quieres).
3. **Define tu catálogo** en la pestaña "Catalogo". Si tu lista de productos aún no es definitiva, agrega una columna `Activo` (Sí/No): el formulario muestra solo los `Sí`, y puedes retirar productos marcándolos `No` sin borrarlos (borrar rompería los pedidos viejos).
4. **Expande las tablas si hace falta.** Las tablas del xlsx tienen rango fijo y no se agrandan solas al escribir desde el formulario:
   - `Tbl_Catalogo` = 10 productos, `Tbl_Clientes` = 5 clientes, `Tbl_Pedidos` = 100 filas.
   - Para agregar productos o clientes, hazlo **dentro** de la tabla (presiona `Tab` en la última celda) o arrastra la esquina de la tabla hacia abajo. Escribir fuera del rango rompe las fórmulas de `VLOOKUP`/`SUMIF`.
5. Crea una fila en **Ciclos** con `Estado = "Abierto"` (y su fecha de cierre).
6. Pega el script y haz la implementación (abajo). Verifica con un pedido de prueba.

## Desplegar

### 1. Script en Google Sheets
1. Sube `ERP_Frutas_Verduras.xlsx` a Drive → ábrelo con Sheets
2. **Extensiones → Apps Script** → pega `google-apps-script.js`
3. **Implementar → Nueva implementación** → Aplicación web → Ejecutar como "Yo" → Acceso "Cualquier persona"
4. Copia la URL (termina en `/exec`)

### 2. Formulario
1. En `index.html`, reemplaza:
   ```js
   const SCRIPT_URL = 'PEGAR_AQUI_TU_URL_DE_APPS_SCRIPT';
   ```
   por la URL del paso anterior

### 3. Vercel
```bash
vercel --prod
```
(estático, sin build command; `index.html` está en la raíz del repo)

### 4. Probar
1. En **Ciclos**, pon una fila con Estado = "Abierto"
2. Abre el link → banner verde "Pedidos abiertos"
3. Haz un pedido de prueba → debe caer en Pedidos con el Ciclo correcto
4. Cambia el Estado del ciclo → recarga → banner rojo, botón bloqueado

Si ambos casos funcionan, el flyer puede salir con ese link.

---

**Nota:** cada vez que edites el Apps Script, hay que hacer una **nueva implementación** para que la URL tome los cambios.
