# Modelo financiero

Este documento describe las reglas que usa la PWA para convertir quincenas, movimientos y compras de tarjeta en ahorro proyectado y adeudo total.

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
- Genera un calendario de pago segun `installments`.
- Una exhibicion cae en la siguiente segunda quincena disponible.
- 3 MSI o 6 MSI reparten el total entre las siguientes segundas quincenas disponibles.
- Si se marca como compartido, se agrega `partnerIncome` por la mitad para reflejar que la pareja aporta esa parte.

## Adeudo total de tarjeta

La pantalla `Tarjeta` muestra dos ideas distintas:

- `Pago al corte`: el siguiente pago programado de TDC.
- `Adeudo total TDC`: el saldo completo estimado, no solo el corte inmediato.

El adeudo total se calcula en `calculateCardDebtFor`.

Componentes:

- `calendarBalance`: suma de la base importada desde `cardCalendar` usando `total` o, si no existe, `userPart`.
- `settingsBalance`: `previousCardDebt - previousCardPayment - pointsPayment + newJulyPurchases`.
- `nonRecurringBalance`: saldo manual no recurrente.
- `scheduledBase`: pagos de TDC existentes en quincenas que no vienen de movimientos nuevos.
- `creditPurchases`: compras de credito registradas en Movimientos.

Formula:

```text
baseDebt = max(calendarBalance, settingsBalance, nonRecurringBalance, scheduledBase)
totalDebt = baseDebt + creditPurchases
```

Esto permite conservar la base importada/manual y, al mismo tiempo, sumar las compras nuevas que captures con tarjeta.

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
- el adeudo total se muestra como numero positivo para lectura humana.

## Donde tocar si cambia la logica

- Tipos: `pwa-finanzas/src/lib/types.ts`
- Calculos: `pwa-finanzas/src/lib/calculations.ts`
- Captura y pantallas: `pwa-finanzas/src/App.tsx`
- Exportaciones: `pwa-finanzas/src/lib/files.ts`
- Semilla publica sin datos personales: `pwa-finanzas/src/lib/seed.ts`
