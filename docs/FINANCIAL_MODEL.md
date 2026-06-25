# Modelo financiero

Este documento describe las reglas que usa la PWA para convertir quincenas, movimientos y compras de tarjeta en ahorro proyectado y saldo utilizado de TDC.

## Conceptos base

### Ajustes

`settings` contiene los supuestos globales:

- `currentSavings`: ahorro real disponible al inicio del plan.
- `rentReserve`: dinero separado para renta; se muestra aparte y no se mezcla con ahorro.
- `salary`: sueldo quincenal esperado.
- `monthlyRent`: renta mensual usada como referencia.
- `defaultFood`: cargo promedio de comida/TDC.
- `chatGpt`: cargo mensual de ChatGPT en tarjeta.
- `previousCardDebt`: adeudo previo de tarjeta antes de movimientos nuevos.
- `previousCardPayment`: pago de tarjeta ya aplicado contra el adeudo previo.
- `pointsPayment`: pago con puntos aplicado contra la tarjeta.
- `newJulyPurchases`: compras extra de tarjeta fuera del calendario importado.
- `nonRecurringBalance`: saldo manual no recurrente.
- `usedCreditBalance`: saldo utilizado real que muestra el banco. Es la fuente principal para la tarjeta.

### Quincenas

Cada `Period` representa una quincena. Los importes que salen de dinero real se guardan negativos:

- `salary`, `extraIncome`, `partnerIncome` suman.
- `rent` y `debitServices` restan.
- `cardPayment` resta cuando llega el pago de tarjeta.
- `foodCredit` y `chatGptCredit` son cargos de tarjeta; no bajan el ahorro al capturarse.

La primera quincena es la base actual del plan. Su ahorro es `settings.currentSavings`; no se recalcula completa para evitar doble conteo de gastos que ya ocurrieron antes de importar o actualizar el respaldo.

## Movimientos

### Efectivo / debito

Un movimiento con metodo `cash` representa dinero que ya salio de ahorro o cuenta de debito.

Reglas:

- En quincenas futuras, se suma como salida en `debitServices`; el flujo de esa quincena baja el ahorro proyectado.
- En la primera quincena, tambien ajusta `settings.currentSavings` directamente, porque esa quincena parte del saldo real actual.
- Si el movimiento esta marcado como compartido, el impacto personal en la primera quincena es la mitad del monto.
- Al borrar el movimiento, el ajuste se revierte.

Ejemplo:

```text
Ahorro actual: 9,928.61
Movimiento debito: 400.00
Nuevo ahorro actual: 9,528.61
```

Si es compartido:

```text
Ahorro actual: 9,928.61
Movimiento debito compartido: 400.00
Impacto personal: 200.00
Nuevo ahorro actual: 9,728.61
```

### Tarjeta de credito

Un movimiento con metodo `credit` representa una compra cargada a TDC.

Reglas:

- La compra aumenta cargos de tarjeta de la quincena donde se capturo.
- No baja el ahorro inmediatamente.
- Aumenta `usedCreditBalance` por el monto completo de la compra, incluso si es MSI.
- Genera un calendario de pago segun `installments`.
- Una exhibicion cae en la siguiente segunda quincena disponible.
- 3 MSI o 6 MSI reparten el total entre las siguientes segundas quincenas disponibles.
- Si se marca como compartido, se agrega `partnerIncome` por la mitad para reflejar que la pareja aporta esa parte.
- Al borrar la compra, se revierte el cargo quincenal, el calendario de pagos y el aumento de `usedCreditBalance`.

### Pago TDC aplicado

Un movimiento con metodo `card_payment` representa un pago real a la tarjeta.

Reglas:

- Resta el monto completo de `usedCreditBalance`.
- No modifica los cargos de compra ni los MSI; solo indica que ya bajaste el saldo usado con un pago.
- En la pantalla `Tarjeta`, los pagos programados se pueden marcar como aplicados.
- El siguiente `Pago al corte` ignora pagos ya registrados y muestra el siguiente pendiente.
- Al borrar el movimiento de pago, el saldo usado vuelve a subir por ese monto.

## Recurrentes

Los recurrentes activos se proyectan en la quincena que corresponde a su dia:

- Dias 1-15 entran en la primera quincena del mes.
- Dias 16-31 entran en la segunda quincena del mes.
- Si el mes no tiene ese dia, se usa el ultimo dia del mes.
- Los recurrentes de debito solo se agregan si `debitServices` no cubre ya ese monto.
- Los recurrentes de credito solo se agregan si `chatGptCredit` no cubre ya ese monto.

Esta regla evita duplicar respaldos antiguos donde las suscripciones ya estaban capturadas manualmente en las quincenas.

## Saldo utilizado de tarjeta

La pantalla `Tarjeta` muestra dos ideas distintas:

- `Pago al corte`: el siguiente pago programado de TDC.
- `Saldo utilizado TDC`: el saldo ocupado de la tarjeta que muestra el banco, equivalente al siguiente corte mas lo que queda a meses.

El saldo utilizado se calcula en `calculateCardDebtFor`.

Componentes:

- `calendarBalance`: suma de saldos no recurrentes (`debt`) desde `cardCalendar`; no suma los totales mensuales completos.
- `usedCreditBalance`: saldo utilizado real capturado en Ajustes.
- `settingsBalance`: respaldo legacy sin doble conteo. Usa `previousCardDebt - previousCardPayment - pointsPayment + newJulyPurchases`, comparado contra `nonRecurringBalance` cuando ese campo ya representa el total.
- `scheduledPayments`: suma de pagos TDC pendientes en quincenas.
- `scheduledFromTransactions`: suma de pagos pendientes generados por movimientos de tarjeta.
- `creditPurchases`: compras de credito registradas en Movimientos; se muestra como referencia, pero no se suma encima si ya esta calendarizada.
- `card_payment`: pagos reales aplicados a la tarjeta; bajan `usedCreditBalance`.

Formula:

```text
totalDebt = usedCreditBalance || saldoCalculadoSinDuplicar || max(scheduledFromTransactions, calendarBalance, nextPayment)
installmentBalance = max(totalDebt - nextPayment, 0)
```

Esto evita inflar el saldo sumando meses futuros completos del calendario o historial viejo ya pagado. El numero confiable es `usedCreditBalance`; cuando agregas o borras compras TDC desde la app, ese saldo sube o baja con la compra. Cuando registras un pago TDC aplicado, baja por el monto pagado.

## Reportes

Los reportes mensuales resumen:

- ingresos;
- gastos efectivo/debito;
- pago TDC;
- flujo;
- ahorro de cierre;
- cargos de credito del mes;
- total de tarjeta importado/calculado.

El CSV mensual se genera desde `src/lib/files.ts`.

## Reglas de signos

Convencion usada en la app:

- ingresos positivos;
- salidas de efectivo/debito negativas;
- pagos de tarjeta negativos;
- compras de tarjeta positivas dentro de `foodCredit`/`chatGptCredit`, porque son cargos antes de pagarse;
- el saldo utilizado de TDC se muestra como numero positivo para lectura humana.

## Donde tocar si cambia la logica

- Tipos: `pwa-finanzas/src/lib/types.ts`
- Calculos: `pwa-finanzas/src/lib/calculations.ts`
- Captura y pantallas: `pwa-finanzas/src/App.tsx`
- Exportaciones: `pwa-finanzas/src/lib/files.ts`
- Semilla publica sin datos personales: `pwa-finanzas/src/lib/seed.ts`
