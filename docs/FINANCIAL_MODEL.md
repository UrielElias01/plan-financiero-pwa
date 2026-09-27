# Modelo financiero v4

El plan comienza vacío, con doce meses desde la fecha actual de Ciudad de México. El horizonte se amplía para mostrar las cuotas pendientes de compras a plazos más largos. Los movimientos, saldos iniciales y estados revisados son los datos de origen. El calendario de tarjeta, los saldos actuales y las tablas quincenales se calculan de nuevo a partir de ellos. Un calendario guardado en un respaldo nunca se suma como una segunda deuda.

La aritmética monetaria usa centavos enteros. Las proyecciones dependen de los importes y fechas registrados: no confirman ingresos futuros, cargos bancarios desconocidos, intereses ni cambios de precio. Esos cambios deben registrarse cuando se conozcan.

## Saldos y movimientos

`openingSavings`, `openingRentReserve` y `openingFoodReserve` son las bases de conciliación. `currentSavings`, `rentReserve` y `foodReserve` se derivan de esas bases y los movimientos reales posteriores. El ahorro es dinero libre; los apartados de renta y comida se muestran por separado.

`balanceAsOf` fija la fecha del saldo comprobado. Los movimientos anteriores se conservan como historial, pero no se vuelven a sumar a ese saldo. `balanceIncludedTransactionIds` identifica los movimientos confirmados que ya estaban incluidos al conciliar, incluidos los de ese mismo día. Así, confirmar después otro movimiento de ese día sí cambia el saldo. Conciliar desde Ajustes sustituye la referencia por el saldo indicado y no añade un ingreso ficticio.

`nextPayday` es la primera nómina todavía por recibir. Una nómina anterior a esa fecha no aparece otra vez como ingreso estimado, aunque no exista un movimiento histórico de nómina. Si todo lo que queda de una quincena es el ahorro comprobado, ese ahorro es el punto de partida completo; no se le suma el sueldo ya gastado.

| Movimiento | Dinero disponible | Tarjeta |
| --- | --- | --- |
| Ingreso | Suma lo recibido, menos sus apartados de renta y comida | Sin efecto |
| Efectivo / débito | Resta del ahorro o del apartado seleccionado | Sin efecto |
| Compra con tarjeta | No resta efectivo al capturarla | Genera una obligación por cuota pendiente |
| Pago TDC | Resta una sola vez lo pagado | Cancela una sola vez obligaciones pendientes |

Agregar, editar o borrar un movimiento posterior a la conciliación recalcula su efecto completo; eliminarlo revierte ese efecto. El motor no conserva una cadena de incrementos que pueda acumular diferencias. Corregir o borrar movimientos del historial ya incluido en la conciliación mantiene el saldo comprobado: ese importe es una medición independiente. Si aquella medición era incorrecta, se corrige expresamente desde Ajustes. Cada movimiento tiene un ID único y una quincena derivada de su fecha: días 1–15 o días 16–fin de mes.

Cada movimiento distingue `status: "planned"` de `status: "confirmed"`. Lo planeado nunca pasa a ser real solo porque llegue su fecha: requiere confirmación. Un movimiento confirmado con fecha futura también queda fuera del saldo real hasta esa fecha. Una fecha de pago prevista no demuestra que el banco haya recibido el dinero.

### Nómina, renta y comida

El sueldo estimado es **por quincena**. Solo se proyecta en quincenas abiertas sin nómina registrada. Una nómina capturada sustituye la estimación; un ingreso extra no sustituye el sueldo.

La nómina guarda sus `rentReserveAmount` y `foodReserveAmount`. Ese dinero pasa del ahorro libre a sus apartados, limitado al ingreso recibido. `monthlyRent` y `monthlyFood` definen el presupuesto mensual; la proyección aparta la mitad por quincena. Editar o eliminar una nómina utiliza los importes guardados aunque después cambie el presupuesto.

Una salida con `fundingSource: "rent_reserve"` o `"food_reserve"` usa primero el apartado elegido y descuenta del ahorro libre únicamente lo que falte. `"savings"` usa el ahorro. Un pago de tarjeta puede salir de un apartado cuando los gastos que cubre ya tenían ese dinero reservado. La salida y la reserva son dos etapas del mismo dinero; no se deben capturar dos pagos por la misma operación.

El registro utiliza fechas sin horas. Dentro del mismo día se procesan primero los ingresos y después las salidas, de modo que los apartados de la nómina de ese día puedan cubrir sus pagos. Este orden es una convención diaria; no demuestra a qué hora estuvo disponible el dinero en el banco.

## Compras a meses

| Campo | Significado |
| --- | --- |
| `amount` | Importe total original |
| `monthlyAmount` | Mensualidad fija del banco |
| `totalInstallments` | Plazo total, de 1 a 120 cuotas |
| `currentInstallment` | Cuotas pagadas **antes de incorporar la compra al registro** |
| `nextPaymentMonth` | Mes de la siguiente cuota pendiente, `AAAA-MM` |
| `remainingPrincipalAmount` | Saldo MSI pendiente confirmado, cuando se dispone del dato bancario |
| `shared` / `userAmount` | Reparto personal explícito, si corresponde |

En el mes futuro `N`, empezando en cero, la cuota es `currentInstallment + N + 1`. Se agrega una mensualidad solamente si no supera el plazo. Las cuotas iniciales ya pagadas no vuelven a generarse.

La deuda después de un mes suma **todas las cuotas todavía pendientes de meses posteriores** de compras registradas. No repite el importe original en cada fila ni suma solo una mensualidad por compra.

Una vez incorporada la compra, sus pagos se registran como **Pago TDC**. No se incrementa además el contador inicial por esos mismos pagos: el contador representa el punto de partida y los movimientos representan lo pagado después. El calendario muestra el número de cuota, el plazo y su saldo pendiente.

Si se corrige ese punto de partida, `installmentsAsOf` y `installmentPaymentIds` conservan la fecha y los pagos ya representados por el contador. El motor evita restar esos pagos otra vez de las cuotas restantes.

En compras antiguas sin mensualidad explícita, el total se divide en centavos y el residuo queda en la última cuota. Con mensualidad bancaria explícita, esa mensualidad es la referencia; no se exige que multiplicarla por el plazo coincida exactamente con el importe original. La última cuota absorbe el saldo pendiente para conservar el total en centavos.

Cuando existe `remainingPrincipalAmount`, la suma de las cuotas futuras coincide con ese saldo; la última puede ajustarse hacia arriba o hacia abajo para absorber el redondeo bancario. El saldo después del corte no incluye otra vez la cuota facturada en ese corte.

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

## Estados de cuenta BBVA

El importador trabaja con una tarjeta BBVA. Cada estado guarda su periodo, fecha de corte, vencimiento, pago para no generar intereses, pago mínimo, deuda total y saldo MSI pendiente. El detalle MSI conserva comercio, importe original, mensualidad, número de cuota facturada, plazo y saldo posterior al corte. La cuota facturada aún puede estar pendiente de pago; no se interpreta como una cuota pagada.

Se revisa la previsualización antes de confirmar. Un mismo corte se reemplaza de forma explícita, evitando agregar otra copia. Los estados anteriores permanecen como historial; el más reciente aplicable es la base de conciliación de la tarjeta. Importar el estado no registra un Pago TDC ni resta ahorro.

El pago para no generar intereses es una obligación del vencimiento del estado e incluye las cuotas MSI ya facturadas. El saldo MSI posterior al corte se programa a partir de la cuota siguiente. No se añade nuevamente la cuota facturada ni el importe original de la compra. Los cargos y pagos anteriores al corte ya pertenecen al estado; solo los movimientos posteriores actualizan esa base. Las suscripciones anteriores al corte tampoco se proyectan de nuevo como deuda adicional.

La importación exige que la deuda total coincida con el pago para no generar intereses más el saldo MSI pendiente, y que la suma del detalle MSI coincida con ese saldo. Una diferencia sin explicar requiere revisión. Este modelo no representa automáticamente otros tipos de crédito, intereses o convenios que rompan esa conciliación. Un estado que indique deuda MSI sin detalle suficiente requiere completar las compras antes de confirmar.

Se pueden abrir archivos PDF, JSON, TXT y la plantilla CSV descargable, además de capturar el estado manualmente. Los archivos se procesan localmente. Los PDF necesitan texto seleccionable; no se incluye OCR de escaneos ni conexión con el banco. La extracción de texto propone campos del resumen con etiquetas reconocidas; el detalle MSI requiere revisión o captura manual. Puede no reconocer todos los formatos de BBVA. El usuario revisa las fechas, importes, cuotas y conceptos antes de aplicar el estado. Un comercio repetido no demuestra por sí solo que sea una suscripción; los cargos recurrentes se confirman como tales. El texto completo del documento y los identificadores de cuenta no se guardan en el estado importado.

## Suscripciones

Las suscripciones tienen importe, medio de pago, día mensual, estado activo y fechas opcionales de inicio y fin. Sus ocurrencias previstas participan en las estimaciones.

Abrir la app no confirma un cargo. El usuario confirma los cargos vencidos desde Suscripciones para incorporarlos al registro real. La identidad de suscripción y mes evita recrear el cargo al volver a confirmar o cambiar su día dentro del mismo mes.

Editar, pausar o eliminar modifica las proyecciones y conserva los movimientos confirmados. Las correcciones de movimientos reales se realizan en Movimientos; las quincenas cerradas deben reabrirse primero.

## Tabla quincenal

Las quincenas son una vista calculada. Capturar ingresos, gastos y pagos en Movimientos y Suscripciones mantiene un solo registro de cada operación.

Se separan flujo real y pendiente. La proyección parte del ahorro libre actual, agrega ingresos todavía estimados y resta gastos pendientes, apartados de renta y comida y pagos de tarjeta necesarios. Los movimientos reales ya incluidos en el saldo actual no vuelven a descontarse.

La tabla y los avisos de liquidez usan la misma secuencia de eventos por fecha. Una nómina posterior al vencimiento de una tarjeta no puede cubrirlo anticipadamente, aunque ambos movimientos estén en la misma quincena. El cierre estimado de una quincena puede ser positivo y aun así existir un faltante antes de su fecha final. Si un pago planeado se coloca después del vencimiento, la proyección conserva la obligación en su fecha límite.

Los pagos vencidos pasan como pendientes a la siguiente quincena abierta. Un pago planeado de un respaldo se incluye en la proyección y reduce la obligación correspondiente en el resto de esa proyección. Hasta confirmarlo, sigue pendiente en el calendario real y no reduce el ahorro comprobado.

Los compromisos que vencen después del horizonte de ingresos siguen visibles en filas adicionales de la tabla. Esas filas se identifican como «Solo compromisos fuera del horizonte de ingresos»: muestran sus pagos pendientes sin prolongar automáticamente las nóminas estimadas ni generar nuevas recurrencias de forma indefinida.

Cerrar una quincena guarda una referencia del saldo y extiende el horizonte. No registra nómina, marca cargos como pagados ni modifica dinero por sí solo. Reabrir permite corregir el historial.

## Respaldos y persistencia

Los respaldos v1, v2 y v3 migran a v4 conservando el efectivo mediante una base de conciliación. Los calendarios y pagos quincenales antiguos de v1/v2 se conservan en `legacySnapshot` como referencia cuando contienen importes y se excluyen del nuevo cálculo. Los campos acumulados antiguos de Ajustes tampoco crean deuda nueva. Los movimientos futuros de respaldos sin estado explícito se migran a planeados y siguen así hasta confirmarlos.

Si falta el número de cuotas ya pagadas, no puede inferirse con certeza. Se conserva cero como punto de partida y se avisa para revisarlo. Los gastos compartidos sin parte explícita mantienen el total y requieren revisión. Un respaldo no se mezcla automáticamente con un plan nuevo.

JSON, IndexedDB y descarga cifrada comparten validación de estructura, versión, importes finitos, fechas reales, IDs únicos, límites de cuotas y reparto. Un respaldo malformado se rechaza antes de reemplazar los datos. Un error de lectura no crea silenciosamente un plan vacío.

El guardado se confirma al completarse la transacción de IndexedDB. Los errores y abortos se comunican a la interfaz y las conexiones se cierran. El service worker actualiza archivos de la app sin borrar IndexedDB.

## Verificación

`tools/verify-finance-engine.mjs`, `tools/verify-period-rollover.mjs` y `tools/verify-backups.mjs` usan datos sintéticos: cuotas, pagos parciales y excedentes, saldos reales frente a proyecciones, cambios de quincena y año, febrero bisiesto, suscripciones editadas, migraciones y respaldos malformados. Se ejecutan con `npm run check:engine`, `npm run check:rollover` y `npm run check:backups`. No requieren importes privados. Los casos basados en datos personales se verifican fuera del repositorio y los respaldos resultantes se entregan por separado.

`npm run check:bbva` ejecuta `tools/verify-bbva.mjs` y `tools/verify-statement-ledger.mjs`: validación y lectura de archivos, conciliación por corte, pagos confirmados frente a planeados, uso de apartados y compromisos fuera del horizonte. `npm test` ejecuta todas estas verificaciones y la del servicio de sincronización.

El motor está en `pwa-finanzas/src/lib/calculations.ts`; su esquema en `types.ts`; validación y persistencia en `validation.ts`, `storage.ts` y `files.ts`. La interfaz está en `pwa-finanzas/src/App.tsx`.
