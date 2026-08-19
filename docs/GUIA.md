# 🔄 Guía: Modelo de Ciclos + Despliegue

## Cómo funciona

```
📢 Flyer publicado
    ↓
📝 Se abren pedidos (pestaña Ciclos: Estado = "Abierto")
    ↓
⏰ Cierre de pedidos (fecha/hora que definas)
    ↓
🛒 Revisar "Lista de Compras" → dice cuánto comprar de cada producto
    ↓
🏪 Ir a comprar → anotar en "Compras" lo real
    ↓
🚚 Entregar → marcar Estado Entrega en Pedidos
    ↓
💰 Cobrar (SINPE/Efectivo) → marcar Estado Pago en Pedidos
    ↓
📦 Llenar "Sobrantes" → ver si algo sirve para el próximo ciclo
```

**El cliente nunca ve nada de "ciclos".** Es 100% interno: el formulario detecta solo cuál ronda está abierta (`doGet` en el script) y le pone esa etiqueta al pedido (`doPost`).

## Pestañas del Excel

| Pestaña | Qué hace |
|---|---|
| Catálogo | Productos y precios (igual que antes) |
| **Ciclos** | Cada ronda: fechas, Estado |
| Pedidos | Ahora con columna Ciclo + Estado Entrega/Pago separados |
| **Lista de Compras** | Suma la demanda por producto + margen de seguridad 10% |
| Sobrantes | Reemplaza Inventario; lo que queda entre ciclos |
| Compras, Clientes, Gastos, Dashboard | Igual que antes, con fórmulas actualizadas |

## Desplegar

### 1. Script en Google Sheets
1. Subí `ERP_Frutas_Verduras.xlsx` a Drive → abrilo con Sheets
2. **Extensiones → Apps Script** → pegá `google-apps-script.js`
3. **Implementar → Nueva implementación** → Aplicación web → Ejecutar como "Yo" → Acceso "Cualquier persona"
4. Copiá la URL (termina en `/exec`)

### 2. Formulario
1. En `index.html`, reemplazá:
   ```js
   const SCRIPT_URL = 'PEGAR_AQUI_TU_URL_DE_APPS_SCRIPT';
   ```
   por la URL del paso anterior

### 3. Vercel
```bash
cd src
vercel --prod
```
(Root Directory = `src`, sin build command, ya que `index.html` está en la raíz de esa carpeta)

### 4. Probar
1. En **Ciclos**, poné una fila con Estado = "Abierto"
2. Abrí el link → banner verde "✅ Pedidos abiertos"
3. Hacé un pedido de prueba → debe caer en Pedidos con el Ciclo correcto
4. Cambiá el Estado del ciclo → recargá → banner rojo, botón bloqueado

Si ambos casos funcionan, el flyer puede salir con ese link.

---

**Nota:** cada vez que edites el Apps Script, hay que hacer una **nueva implementación** para que la URL tome los cambios.
