# Modelo financiero

La PWA usa los movimientos como fuente de verdad. Las quincenas agrupan y proyectan; no tienen campos manuales que cambien saldos por su cuenta.

## Saldos reales

- `currentSavings`: dinero disponible real.
- `rentReserve`: dinero separado para renta y fuera del ahorro disponible.
- `usedCreditBalance`: credito ocupado total que muestra el banco.
- `monthlyRent`: renta mensual; una nomina aparta la mitad.

Los demas campos antiguos de `Settings` y `Period` se conservan solo para importar respaldos anteriores. Al normalizar un respaldo version 1, las estimaciones de sueldo, pareja, comida, servicios y otros cargos dejan de participar en los calculos.

## Movimientos

Cada movimiento tiene una fecha real. La app asigna su quincena automaticamente:

- dias 1 al 15: primera quincena;
- dias 16 al ultimo dia: segunda quincena.

No se aceptan fechas futuras. Una quincena cerrada debe reabrirse antes de cambiar sus movimientos.

### Ingreso

Un movimiento `income` suma al ahorro.

Si la categoria es `Nomina`, tambien aparta `monthlyRent / 2` en `rentReserve`. El movimiento guarda el monto exacto apartado para que editarlo o borrarlo revierta la misma cantidad, aunque despues cambie la renta mensual.

Otros ingresos, reembolsos y ventas suman el monto completo al ahorro. Un reembolso de una compra compartida se registra asi, en vez de calcular una aportacion de pareja.

### Debito o efectivo

Un movimiento `cash` resta el monto real de `currentSavings` al guardarse. Al editarlo se revierte el movimiento anterior y se aplica el nuevo; al borrarlo se devuelve el monto.

### Tarjeta de credito

Un movimiento `credit`:

- no baja el ahorro al comprar;
- aumenta `usedCreditBalance` por el monto completo;
- aparece como cargo TDC de su quincena;
- crea el calendario de una exhibicion, 3 MSI o 6 MSI.

La fecha de corte decide el primer pago:

- compra en o antes del dia de corte: segunda quincena del mismo mes;
- compra despues del corte: segunda quincena del mes siguiente.

### Pago TDC

Un movimiento `card_payment` resta el mismo monto de `currentSavings` y de `usedCreditBalance`. Los pagos ya registrados se descuentan del siguiente pago pendiente.

Los pagos existentes en respaldos version 1 conservan el comportamiento anterior al editarse: no se les aplica retroactivamente una salida de ahorro que la version vieja nunca registro.

## Renta

La renta es el unico efecto automatico ligado a un ingreso manual:

```text
Nomina registrada
  -> ahorro += nomina - media renta
  -> renta apartada += media renta
```

`Ajustes > Renta pagada` pone el apartado en cero cuando la renta ya salio de ese dinero separado. No vuelve a restarla del ahorro.

## Recurrentes

Los recurrentes activos se proyectan en fechas futuras, pero no cambian saldos reales antes de su dia.

Al llegar la fecha y abrir la app:

- debito se materializa como gasto y baja el ahorro;
- tarjeta se materializa como compra, aumenta el saldo usado y agenda su pago segun el corte.

Cada movimiento automatico guarda `sourceRecurringId` y `recurringDate`. Si se cambia dia, monto, nombre, medio o estado del recurrente dentro de una quincena abierta, la app revierte el movimiento automatico anterior y solo vuelve a aplicarlo si la nueva fecha ya vencio. Los movimientos automaticos se corrigen desde Recurrentes para evitar duplicados.

## Quincenas

Quincenas es un resumen, no un segundo formulario de captura. Muestra:

- ingresos reales;
- gastos de debito/efectivo;
- cargos TDC;
- pago TDC programado;
- flujo y ahorro.

La quincena de la fecha actual muestra `currentSavings` como ahorro real. Los periodos futuros proyectan solo obligaciones conocidas: recurrentes y pagos de tarjeta. No inventan sueldo, comida ni aportaciones.

Cerrar una quincena solo la archiva, guarda una referencia del ahorro y agrega la siguiente si falta. No suma ingresos, no aparta renta y no cambia la tarjeta. Reabrir tampoco modifica saldos.

## Saldo utilizado TDC

`usedCreditBalance` es la fuente principal. Una compra real lo aumenta y un pago real lo reduce. La migracion de respaldos antiguos conserva la correccion de saldos congelados, pero las proyecciones futuras nunca se agregan al saldo ocupado antes de convertirse en movimientos.

## Archivos principales

- Tipos: `pwa-finanzas/src/lib/types.ts`
- Calculos y migraciones: `pwa-finanzas/src/lib/calculations.ts`
- Captura y pantallas: `pwa-finanzas/src/App.tsx`
- Semilla publica: `pwa-finanzas/src/lib/seed.ts`
