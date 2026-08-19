/**
 * Google Apps Script - Recibe pedidos del formulario web
 * y los agrega a Pedidos, detectando el Ciclo abierto automáticamente.
 *
 * Autor: Keyron
 * Versión: 2.0 (modelo de Ciclos de preventa)
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
 * GET - El formulario lo llama al cargar para saber si hay pedidos abiertos
 */
function doGet(e) {
  var ciclo = obtenerCicloAbierto();

  var respuesta = ciclo
    ? { abierto: true, ciclo: ciclo.id, cierre: ciclo.cierre }
    : { abierto: false };

  return ContentService.createTextOutput(JSON.stringify(respuesta))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * POST - El formulario lo llama al enviar un pedido
 */
function doPost(e) {
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

    var fecha = Utilities.formatDate(new Date(), 'America/Costa_Rica', 'dd/MM/yyyy');

    var lastRow = sheetPedidos.getLastRow();
    var ultimoNumero = 0;
    if (lastRow > 1) {
      var valor = sheetPedidos.getRange(lastRow, 1).getValue();
      if (typeof valor === 'number') ultimoNumero = valor;
    }
    var numeroPedido = ultimoNumero + 1;

    // Una fila por producto del pedido
    data.productos.forEach(function (producto) {
      var fila = [
        numeroPedido,        // # 
        ciclo.id,             // Ciclo (detectado automático)
        fecha,                // Fecha Pedido
        producto.producto,    // Producto
        data.tipoCliente,     // Tipo Cliente
        producto.cantidad,    // Cantidad
        data.nombre,          // Cliente
        data.direccion,       // Dirección
        data.horario,         // Horario
        data.metodoPago,      // Método Pago
        producto.subtotal,    // Total (₡) -- la fórmula de la hoja lo recalcula igual
        'Pendiente',          // Estado Entrega
        'Pendiente'           // Estado Pago
      ];
      sheetPedidos.appendRow(fila);
      numeroPedido++;
    });

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
  }
}

/**
 * Función de prueba - ejecutar manualmente desde el editor para probar
 */
function testFlujo() {
  Logger.log('Ciclo abierto: ' + JSON.stringify(obtenerCicloAbierto()));

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
          { producto: 'Banano', cantidad: 3, precio: 1080, subtotal: 3240 }
        ]
      })
    }
  };

  Logger.log(doPost(datosPrueba).getContent());
}
