# Modelo financiero v3

El plan comienza vacío, con doce meses desde la fecha actual de Ciudad de México. Los movimientos y saldos iniciales son los datos de origen. El calendario de tarjeta, los saldos actuales y las tablas quincenales se calculan de nuevo a partir de ellos. Un calendario guardado en un respaldo nunca se suma como una segunda deuda.

La aritmética monetaria usa centavos enteros. Las proyecciones dependen de los importes y fechas registrados: no confirman ingresos futuros, cargos bancarios desconocidos, intereses ni cambios de precio. Esos cambios deben registrarse cuando se conozcan.

## Saldos y movimientos

`openingSavings` y `openingRentReserve` son las bases de conciliación. `currentSavings` y `rentReserve` se derivan de esas bases y los movimientos reales hasta la fecha consultada. Conciliar desde Ajustes modifica la base necesaria para obtener el saldo indicado; no añade un ingreso ficticio.

| Movimiento | Dinero disponible | Tarjeta |
| --- | --- | --- |
| Ingreso | Suma lo recibido, menos su apartado de renta si aplica | Sin efecto |
| Efectivo / débito | Resta lo que salió de tu dinero | Sin efecto |
| Compra con tarjeta | No resta efectivo al capturarla | Genera una obligación por cuota pendiente |
| Pago TDC | Resta una sola vez lo pagado | Cancela una sola vez obligaciones pendientes |

Editar o borrar recalcula el registro completo. No conserva una cadena de incrementos y reversiones que pueda acumular diferencias. Cada movimiento tiene un ID único y una quincena derivada de su fecha: días 1–15 o días 16–fin de mes.

La interfaz registra movimientos cuando ocurren. Si un respaldo contiene fechas futuras, el motor las trata como proyecciones hasta esa fecha y las excluye del saldo real.

### Nómina y renta

El sueldo estimado es **por quincena**. Solo se proyecta en quincenas abiertas sin nómina registrada. Una nómina capturada sustituye la estimación; un ingreso extra no sustituye el sueldo.

La nómina guarda su `rentReserveAmount`. Ese dinero pasa del disponible al apartado de renta, limitado al ingreso recibido. Editar o eliminar la nómina utiliza el importe guardado aunque después cambie la renta mensual.

**Renta pagada** vacía el apartado mediante conciliación. No vuelve a descontarlo del dinero disponible, porque el apartado ya estaba fuera de ese saldo. Para conservar el flujo correcto, no se registra además la misma renta como otra salida del disponible.

## Compras a meses

| Campo | Significado |
| --- | --- |
| `amount` | Importe total original |
| `monthlyAmount` | Mensualidad fija del banco |
| `totalInstallments` | Plazo total, de 1 a 120 cuotas |
| `currentInstallment` | Cuotas pagadas **antes de incorporar la compra al registro** |
| `nextPaymentMonth` | Mes de la siguiente cuota pendiente, `AAAA-MM` |
| `shared` / `userAmount` | Reparto personal explícito, si corresponde |

En el mes futuro `N`, empezando en cero, la cuota es `currentInstallment + N + 1`. Se agrega una mensualidad solamente si no supera el plazo. Las cuotas iniciales ya pagadas no vuelven a generarse.

La deuda después de un mes suma **todas las cuotas todavía pendientes de meses posteriores** de compras registradas. No repite el importe original en cada fila ni suma solo una mensualidad por compra.

Una vez incorporada la compra, sus pagos se registran como **Pago TDC**. No se incrementa además el contador inicial por esos mismos pagos: el contador representa el punto de partida y los movimientos representan lo pagado después. El calendario muestra el número de cuota, el plazo y su saldo pendiente.

Si se corrige ese punto de partida, `installmentsAsOf` y `installmentPaymentIds` conservan la fecha y los pagos ya representados por el contador. El motor evita restar esos pagos otra vez de las cuotas restantes.

En compras antiguas sin mensualidad explícita, el total se divide en centavos y el residuo queda en la última cuota. Con mensualidad bancaria explícita, esa mensualidad es la referencia. La interfaz comprueba su coherencia con el total y el plazo, permitiendo diferencias de redondeo de un centavo por cuota.

### Corte y vencimiento

Una compra en o antes del corte corresponde a ese estado de cuenta; después del corte corresponde al siguiente. Si el día de pago es anterior o igual al corte, el vencimiento queda en el mes siguiente. Los días inexistentes se ajustan al último día del mes.

El próximo mes de pago de una compra a meses puede indicarse para coincidir con el banco. Se usan claves `AAAA-MM`, evitando mezclar el mismo mes de años distintos.

### Total y parte personal

Compartir es una decisión por transacción. No hay un porcentaje global de pareja. Si falta el reparto explícito, la parte personal es el total.

La tarjeta conserva la obligación completa ante el banco aunque la parte personal sea menor. `userPart` informa el reparto y no reduce el pago bancario. Un reembolso se registra como ingreso al recibirlo. En efectivo o débito se captura lo que realmente salió de tu dinero.

## Pagos y calendario de tarjeta

`openingCardDebt` representa exclusivamente deuda inicial **ausente de las compras registradas**. Incluir una compra en ambos lugares duplicaría la captura. El saldo inicial tiene un mes de pago explícito.

Un Pago TDC prioriza la quincena elegida, si se indica una. El remanente se distribuye en orden de vencimiento. El excedente sobre toda la deuda conocida queda como saldo a favor, sin volver negativa la deuda. El saldo a favor puede cubrir cargos futuros en la proyección.

| Campo del calendario | Significado |
| --- | --- |
| `monthKey` / `dueDate` | Mes y fecha de vencimiento |
| `total` | Obligaciones completas del mes |
| `userPart` | Parte personal explícita, informativa |
| `paid` | Pagos reales asignados |
| `remaining` | Importe pendiente del mes |
| `projected` | Cargos estimados, como suscripciones sin confirmar |
| `debt` | Cuotas de compras reales pendientes después del mes |
| `installments` | Compra, número de cuota, plazo y saldo pendiente |

La deuda real excluye suscripciones futuras sin confirmar. El calendario puede incluirlas para anticipar el efectivo necesario. Una mensualidad y su pago no son dos obligaciones: el pago cancela la mensualidad.

## Suscripciones

Las suscripciones tienen importe, medio de pago, día mensual, estado activo y fechas opcionales de inicio y fin. Sus ocurrencias previstas participan en las estimaciones.

Abrir la app no confirma un cargo. El usuario confirma los cargos vencidos desde Suscripciones para incorporarlos al registro real. La identidad de suscripción y mes evita recrear el cargo al volver a confirmar o cambiar su día dentro del mismo mes.

Editar, pausar o eliminar modifica las proyecciones y conserva los movimientos confirmados. Las correcciones de movimientos reales se realizan en Movimientos; las quincenas cerradas deben reabrirse primero.

## Tabla quincenal

Las quincenas son una vista calculada. Capturar ingresos, gastos y pagos en Movimientos y Suscripciones mantiene un solo registro de cada operación.

Se separan flujo real y pendiente. La proyección parte del dinero disponible actual, agrega ingresos todavía estimados y resta gastos pendientes, apartados de renta y pagos de tarjeta necesarios. Los movimientos reales ya incluidos en el saldo actual no vuelven a descontarse.

Los pagos vencidos pasan como pendientes a la siguiente quincena abierta. Un pago planeado de un respaldo se incluye en su fecha prevista y reduce la obligación correspondiente en el resto de la proyección.

Cerrar una quincena guarda una referencia del saldo y extiende el horizonte. No registra nómina, marca cargos como pagados ni modifica dinero por sí solo. Reabrir permite corregir el historial.

## Respaldos y persistencia

Los respaldos v1 y v2 migran a v3 conservando el efectivo mediante una base de conciliación. Los calendarios y pagos quincenales antiguos se conservan en `legacySnapshot` como referencia cuando contienen importes y se excluyen del nuevo cálculo. Los campos acumulados antiguos de Ajustes tampoco crean deuda nueva.

Si falta el número de cuotas ya pagadas, no puede inferirse con certeza. Se conserva cero como punto de partida y se avisa para revisarlo. Los gastos compartidos sin parte explícita mantienen el total y requieren revisión. Un respaldo no se mezcla automáticamente con un plan nuevo.

JSON, IndexedDB y descarga cifrada comparten validación de estructura, versión, importes finitos, fechas reales, IDs únicos, límites de cuotas y reparto. Un respaldo malformado se rechaza antes de reemplazar los datos. Un error de lectura no crea silenciosamente un plan vacío.

El guardado se confirma al completarse la transacción de IndexedDB. Los errores y abortos se comunican a la interfaz y las conexiones se cierran. El service worker actualiza archivos de la app sin borrar IndexedDB.

## Verificación

`tools/verify-finance-engine.mjs` y `tools/verify-backups.mjs` usan datos sintéticos: cuotas, pagos parciales y excedentes, saldos reales frente a proyecciones, suscripciones editadas, migraciones y respaldos malformados. Se ejecutan con `npm run check:engine` y `npm run check:backups`. No requieren importes privados.

El motor está en `pwa-finanzas/src/lib/calculations.ts`; su esquema en `types.ts`; validación y persistencia en `validation.ts`, `storage.ts` y `files.ts`. La interfaz está en `pwa-finanzas/src/App.tsx`.
