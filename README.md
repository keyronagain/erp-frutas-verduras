# Sistema ERP - Frutas y Verduras

Sistema que creé para el negocio de mi papá: preventa por ciclos usando Google Sheets + formulario web.

## ¿Qué hace?

- Los clientes piden por adelantado (formulario web), no hay stock parado
- Al cerrar una ronda, calcula automáticamente cuánto comprar de cada producto
- Calcula precios considerando merma
- Separa "entregado" de "cobrado" (pago SINPE/efectivo al momento de entregar)
- Genera reportes en tiempo real

**100% gratis. 100% desde el celular.**

## Instalación Rápida

1. Descarga `src/ERP_Frutas_Verduras.xlsx`
2. Súbelo a Google Drive
3. Ábrelo con Google Sheets
4. ¡Listo!

Para activar el formulario web (opcional), mira [`docs/GUIA.md`](docs/GUIA.md).

## Contenido

- `src/ERP_Frutas_Verduras.xlsx` — plantilla con 9 pestañas
- `index.html` — formulario para clientes (listo para Vercel)
- `src/google-apps-script.js` — conecta el formulario con Sheets
- `docs/GUIA.md` — cómo funciona el modelo de ciclos + cómo desplegar

## El modelo: preventa por ciclos

```
Se abren pedidos → Se cierran → Se calcula cuánto comprar
→ Se compra → Se entrega → Se cobra
```

En vez de comprar "a ojo" y esperar vender, primero juntas los pedidos de una ronda y compras exactamente lo que se necesita (+ 10% de margen de seguridad). Reduce muchísimo la merma.

El cliente solo ve un formulario normal — el sistema detecta solo si hay una ronda abierta.

## La fórmula de precios (con merma)

```
Precio = (Costo Compra / (1 - Merma%)) × (1 + Margen%)
```

Ejemplo: compras a ₡600/kg, se pudre 5%, quieres ganar 30%
```
Precio = (600 / 0.95) × 1.30 = ₡822/kg
```

## Licencia

MIT — úsalo como quieras, gratis.

---

**Hecho en Costa Rica**
