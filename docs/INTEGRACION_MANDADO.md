# Integración con la app Mandado

Mandado registra lo que realmente se pagó en el súper (tickets). El plan financiero usa esos importes en lugar del presupuesto estimado de la categoría «Mandado».

## Estado

- **Plan financiero:** listo. *Más → Compras de la app Mandado* abre el archivo, muestra cuántas compras son nuevas y cuántas ya estaban, y las agrega como movimientos de la categoría «Mandado».
- **Mandado:** falta la opción para exportar. Debe generar el archivo descrito aquí y compartirlo (por ejemplo, con el menú Compartir de Android).

## Archivo (`.json`)

```json
{
  "formato": "mandado-gastos",
  "version": 1,
  "exportadoEn": "2026-10-05T18:00:00Z",
  "compras": [
    { "id": 123, "fecha": "2026-10-04", "tienda": "Chedraui", "totalCentavos": 84550, "metodo": "tarjeta" }
  ]
}
```

| Campo | Obligatorio | Regla |
| --- | --- | --- |
| `formato` | Sí | Siempre `"mandado-gastos"` |
| `version` | Sí | `1`; otra versión se rechaza |
| `compras[].id` | Sí | Identificador estable del ticket en Mandado (`Ticket.id`) |
| `compras[].fecha` | Sí | `AAAA-MM-DD`, fecha real de la compra |
| `compras[].tienda` | No | Cadena o sucursal; se muestra como «Mandado · tienda» |
| `compras[].totalCentavos` | Sí | Entero mayor que cero (`Ticket.totalCentavos`) |
| `compras[].metodo` | No | `"tarjeta"`, `"debito"` o `"efectivo"`; si falta, el usuario elige al importar |

No se envían renglones, precios por producto ni datos de la tienda en línea: el plan solo necesita cuánto y cuándo se pagó.

## Reglas al importar

- Cada ticket se identifica como `mandado:<id>`. Importar el mismo archivo otra vez no agrega nada.
- Si ya existe la misma compra registrada a mano o importada del estado de cuenta (mismo importe, a lo más dos días de diferencia), no se duplica. Dos tickets iguales de Mandado sí cuentan como dos compras.
- Con tarjeta: es deuda de la tarjeta desde su fecha y entra en el siguiente pago. Con débito o efectivo: resta del dinero disponible.
- La compra consume el presupuesto «Mandado» del mes o del ciclo de la tarjeta, así que la proyección no la cuenta dos veces.

La implementación y sus pruebas están en `pwa-finanzas/src/lib/imports.ts` y `tools/verify-outlook.mjs`.
