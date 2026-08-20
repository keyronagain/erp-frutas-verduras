/**
 * Google Apps Script - Recibe pedidos del formulario web
 * y los agrega a Pedidos, detectando el Ciclo abierto automáticamente.
 *
 * Autor: Keyron
 * Versión: 2.2 (catálogo dinámico + validación + CRM Clientes + LockService)
 */

/**
 * Busca en la hoja Ciclos la fila con Estado = "Abierto"
 * Devuelve { id, cierre } o null si no hay ninguno abierto
 */
function obtenerCicloAbierto() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Ciclos');
  var data = sheet.getDataRange().getValues();
  var headers = data[0];

  var colID = headers.indexOf('ID Ciclo');
  var colEstado = headers.indexOf('Estado');
  var colCierre = headers.indexOf('Cierre Pedidos');

  for (var i = 1; i < data.length; i++) {
    if (data[i][colEstado] === 'Abierto') {
      return {
        id: data[i][colID],
        cierre: data[i][colCierre]
      };
    }
  }
  return null;
}

/**
 * Lee la pestaña "Catalogo" (sin tilde) y devuelve la lista de productos
 * con precio, unidad y estado activo: [{ producto, precio, unidad, activo }]
 * Se salta las filas sin producto (ej. la nota explicativa de la hoja).
 * Si existe una columna "Activo" (Sí/No), marca los inactivos como activo=false.
 */
function obtenerCatalogo() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Catalogo');
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  var headers = data[0];

  var colProducto = headers.indexOf('Producto');
  var colUnidad = headers.indexOf('Unidad');
  var colActivo = headers.indexOf('Activo');

  // La columna de precio se llama "Precio Venta (₡)"; se busca por prefijo
  // para no depender del símbolo ₡.
  var colPrecio = -1;
  for (var c = 0; c < headers.length; c++) {
    if (typeof headers[c] === 'string' && headers[c].indexOf('Precio Venta') === 0) {
      colPrecio = c;
      break;
    }
  }

  var catalogo = [];
  for (var i = 1; i < data.length; i++) {
    var nombre = data[i][colProducto];
    if (!nombre) continue;

    var activo = true;
    if (colActivo >= 0) {
      var valorActivo = String(data[i][colActivo]).trim().toLowerCase();
      activo = (valorActivo === 'sí' || valorActivo === 'si' || valorActivo === 'yes' || valorActivo === 'true' || valorActivo === '1');
    }

    catalogo.push({
      producto: nombre,
      precio: data[i][colPrecio],
      unidad: data[i][colUnidad],
      activo: activo
    });
  }
  return catalogo;
}

/**
 * Fecha del pedido como Date real (no texto), basada en la fecha de Costa Rica.
 * Se construye a mediodía UTC para que el huso horario no cambie el día.
 */
function obtenerFechaPedido() {
  var ahora = new Date();
  var s = Utilities.formatDate(ahora, 'America/Costa_Rica', 'yyyy-MM-dd');
  var partes = s.split('-');
  return new Date(Date.UTC(
    parseInt(partes[0], 10),
    parseInt(partes[1], 10) - 1,
    parseInt(partes[2], 10),
    12, 0, 0
  ));
}

/**
 * Valida el pedido recibido contra el catálogo. Devuelve un mensaje de error
 * (string) si algo está mal, o null si es válido.
 */
function validarPedido(data, catalogo) {
  if (!data || typeof data !== 'object') return 'Pedido inválido.';

  if (!String(data.nombre || '').trim()) return 'Falta el nombre del cliente.';
  if (!String(data.direccion || '').trim()) return 'Falta la dirección.';

  var tiposValidos = ['Casa', 'Edificio', 'Negocio'];
  if (tiposValidos.indexOf(data.tipoCliente) === -1) return 'Tipo de cliente no válido.';

  var horariosValidos = ['8:00-10:00 AM', '10:00-12:00 PM', '2:00-4:00 PM'];
  if (horariosValidos.indexOf(data.horario) === -1) return 'Horario no válido.';

  var pagosValidos = ['Efectivo', 'SINPE'];
  if (pagosValidos.indexOf(data.metodoPago) === -1) return 'Método de pago no válido.';

  if (!Array.isArray(data.productos) || data.productos.length === 0) {
    return 'El pedido no tiene productos.';
  }

  var info = {};
  for (var i = 0; i < catalogo.length; i++) {
    info[catalogo[i].producto] = catalogo[i];
  }

  for (var j = 0; j < data.productos.length; j++) {
    var p = data.productos[j];
    var nombreProducto = p && p.producto;
    if (!nombreProducto) return 'Producto no válido.';

    var registro = info[nombreProducto];
    if (!registro) return 'El producto "' + nombreProducto + '" no existe en el catálogo.';
    if (!registro.activo) return 'El producto "' + nombreProducto + '" no está disponible en este momento.';

    var cantidad = p.cantidad;
    if (typeof cantidad !== 'number' || !isFinite(cantidad) || cantidad <= 0 || Math.floor(cantidad) !== cantidad) {
      return 'Cantidad no válida para "' + nombreProducto + '".';
    }
    if (cantidad > 1000) return 'Cantidad demasiado grande para "' + nombreProducto + '".';
  }

  return null;
}

/**
 * Registra o actualiza un cliente en la pestaña "Clientes".
 * Columnas: ID, Nombre, Tipo, Teléfono, Dirección Base (las dos últimas son fórmulas).
 * - Si el cliente ya existe (por nombre), actualiza Teléfono y Dirección Base.
 * - Si no, agrega una fila nueva y copia las fórmulas de Total Compras / Última Compra.
 */
function registrarCliente(nombre, tipoCliente, telefono, direccion) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Clientes');
  if (!sheet) return;

  var data = sheet.getDataRange().getValues();
  if (data.length === 0) return;

  var headers = data[0];
  var colID = headers.indexOf('ID');
  var colNombre = headers.indexOf('Nombre');
  var colTel = headers.indexOf('Teléfono');
  var colDir = headers.indexOf('Dirección Base');

  var nombreNormalizado = String(nombre || '').trim().toLowerCase();
  var filaExistente = -1;
  var maxNum = 0;

  for (var i = 1; i < data.length; i++) {
    var idVal = data[i][colID];
    var num = parseInt(String(idVal).replace(/\D/g, ''), 10);
    if (!isNaN(num) && num > maxNum) maxNum = num;

    var nombreHoja = String(data[i][colNombre] || '').trim().toLowerCase();
    if (nombreHoja && nombreHoja === nombreNormalizado) filaExistente = i;
  }

  if (filaExistente >= 0) {
    var filaNum = filaExistente + 1;
    if (colTel >= 0) sheet.getRange(filaNum, colTel + 1).setValue(telefono);
    if (colDir >= 0) sheet.getRange(filaNum, colDir + 1).setValue(direccion);
    return;
  }

  // Cliente nuevo
  var nuevoID = 'C' + ('000' + (maxNum + 1)).slice(-3);
  sheet.appendRow([nuevoID, nombre, tipoCliente, telefono, direccion]);
  var nuevaFila = sheet.getLastRow();

  // Copiar las fórmulas (Total Compras, Última Compra) de una fila existente,
  // porque las tablas no auto-rellenan fórmulas al usar appendRow.
  var filaConFormula = -1;
  for (var k = 1; k < data.length; k++) {
    if (sheet.getRange(k + 1, 6).getFormula()) {
      filaConFormula = k;
      break;
    }
  }

  if (filaConFormula >= 0) {
    var refFila = filaConFormula + 1;
    var formulaTotal = sheet.getRange(refFila, 6).getFormula();
    var formulaUltima = sheet.getRange(refFila, 7).getFormula();
    if (formulaTotal) sheet.getRange(nuevaFila, 6).setFormula(formulaTotal);
    if (formulaUltima) {
      sheet.getRange(nuevaFila, 7).setFormula(formulaUltima);
      sheet.getRange(nuevaFila, 7).setNumberFormat('dd/MM/yyyy');
    }
  } else {
    // Respaldo: si no hay ninguna fila de ejemplo con fórmulas (hoja limpia),
    // se escriben las fórmulas directamente.
    sheet.getRange(nuevaFila, 6).setFormula('=SUMIF(Tbl_Pedidos[Cliente],B' + nuevaFila + ',Tbl_Pedidos[Total (₡)])');
    sheet.getRange(nuevaFila, 7).setFormula('=IFERROR(MAXIFS(Tbl_Pedidos[Fecha Pedido],Tbl_Pedidos[Cliente],B' + nuevaFila + '),"Sin compras")');
    sheet.getRange(nuevaFila, 7).setNumberFormat('dd/MM/yyyy');
  }
}

/**
 * GET - El formulario lo llama al cargar para saber si hay pedidos abiertos
 * y para obtener el catálogo de productos activos con sus precios.
 */
function doGet(e) {
  var ciclo = obtenerCicloAbierto();
  var catalogo = obtenerCatalogo().filter(function (p) { return p.activo; });

  var respuesta = ciclo
    ? { abierto: true, ciclo: ciclo.id, cierre: ciclo.cierre, catalogo: catalogo }
    : { abierto: false, catalogo: catalogo };

  return ContentService.createTextOutput(JSON.stringify(respuesta))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * POST - El formulario lo llama al enviar un pedido.
 * Valida el pedido, usa LockService para evitar colisiones al calcular el
 * número de pedido, y registra al cliente en la pestaña Clientes.
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  var lockAdquirido = false;

  try {
    var sheetPedidos = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Pedidos');
    if (!sheetPedidos) throw new Error('No se encontró la hoja "Pedidos"');

    // Verificar que haya un ciclo abierto (defensa server-side, aunque el
    // formulario ya debería haber bloqueado el envío si estaba cerrado)
    var ciclo = obtenerCicloAbierto();
    if (!ciclo) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'No hay ninguna ronda de pedidos abierta en este momento.'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var data = JSON.parse(e.postData.contents);

    // Validar contra el catálogo (fuente de verdad de productos y precios)
    var catalogo = obtenerCatalogo();
    var error = validarPedido(data, catalogo);
    if (error) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: error
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var precios = {};
    for (var i = 0; i < catalogo.length; i++) {
      precios[catalogo[i].producto] = catalogo[i].precio;
    }

    // Bloquear antes de leer/escribir en "Pedidos" y "Clientes" (10 segundos)
    lockAdquirido = lock.tryLock(10000);
    if (!lockAdquirido) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'Servidor ocupado. Inténtalo de nuevo en unos segundos.'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var fecha = obtenerFechaPedido();

    // Número de pedido: el máximo valor numérico de la columna "#".
    // Se recorre toda la columna (no solo la última fila) para ignorar
    // filas de nota u otro texto que pueda quedar en la hoja.
    var datosPedidos = sheetPedidos.getDataRange().getValues();
    var ultimoNumero = 0;
    for (var j = 1; j < datosPedidos.length; j++) {
      var valor = datosPedidos[j][0];
      if (typeof valor === 'number' && valor > ultimoNumero) {
        ultimoNumero = valor;
      }
    }
    var numeroPedido = ultimoNumero + 1;

    // Una fila por producto del pedido.
    // OJO: el orden de este array debe coincidir EXACTAMENTE con las columnas
    // de la hoja "Pedidos": #, Ciclo, Fecha Pedido, Producto, Tipo Cliente,
    // Cantidad, Cliente, Dirección, Horario, Método Pago, Total (₡),
    // Estado Entrega, Estado Pago.
    data.productos.forEach(function (producto) {
      var subtotal = producto.cantidad * precios[producto.producto];
      var fila = [
        numeroPedido,        // #
        ciclo.id,            // Ciclo (detectado automático)
        fecha,               // Fecha Pedido (Date real)
        producto.producto,   // Producto
        data.tipoCliente,    // Tipo Cliente
        producto.cantidad,   // Cantidad
        data.nombre,         // Cliente
        data.direccion,      // Dirección
        data.horario,        // Horario
        data.metodoPago,     // Método Pago
        subtotal,            // Total (₡) recalculado en el servidor
        'Pendiente',         // Estado Entrega
        'Pendiente'          // Estado Pago
      ];
      sheetPedidos.appendRow(fila);
      sheetPedidos.getRange(sheetPedidos.getLastRow(), 3).setNumberFormat('dd/MM/yyyy');
      numeroPedido++;
    });

    registrarCliente(data.nombre, data.tipoCliente, data.telefono, data.direccion);

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      ciclo: ciclo.id,
      message: 'Pedido recibido correctamente'
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log('Error en doPost: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Error al procesar pedido: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    if (lockAdquirido) {
      lock.releaseLock();
    }
  }
}

/**
 * Función de prueba - ejecutar manualmente desde el editor para probar
 */
function testFlujo() {
  Logger.log('Ciclo abierto: ' + JSON.stringify(obtenerCicloAbierto()));
  var catalogo = obtenerCatalogo();
  Logger.log('Catálogo: ' + JSON.stringify(catalogo));

  var primerProducto = (catalogo.length > 0) ? catalogo[0].producto : 'Banano';

  var datosPrueba = {
    postData: {
      contents: JSON.stringify({
        nombre: 'Cliente de Prueba',
        telefono: '8888-8888',
        tipoCliente: 'Casa',
        direccion: 'Dirección de prueba',
        horario: '10:00-12:00 PM',
        metodoPago: 'Efectivo',
        productos: [
          { producto: primerProducto, cantidad: 3 }
        ]
      })
    }
  };

  Logger.log(doPost(datosPrueba).getContent());
}
