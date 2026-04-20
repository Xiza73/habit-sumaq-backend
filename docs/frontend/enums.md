# Enums — Referencia para Frontend

Todos los enums que el backend envía y acepta. Los valores son **case-sensitive** y deben enviarse exactamente como aparecen aquí.

---

## AccountType

Tipo de cuenta financiera.

| Valor         | Descripción                                   |
| ------------- | --------------------------------------------- |
| `checking`    | Cuenta corriente                              |
| `savings`     | Cuenta de ahorros                             |
| `cash`        | Efectivo                                      |
| `credit_card` | Tarjeta de crédito (permite balance negativo) |
| `investment`  | Inversiones                                   |

**Nota:** Solo las cuentas `credit_card` permiten balance negativo.

**Uso:** campo `type` en `POST /accounts` y respuesta de cuentas.

---

## Currency

Moneda de la cuenta. Define la unidad del balance y de las transacciones asociadas.

| Valor | Descripción          |
| ----- | -------------------- |
| `PEN` | Sol peruano          |
| `USD` | Dólar estadounidense |
| `EUR` | Euro                 |

**Restricción:** las transferencias entre cuentas solo son válidas si ambas cuentas comparten la misma moneda. No hay conversión automática.

**Uso:** campo `currency` en `POST /accounts` y respuesta de cuentas.

---

## CategoryType

Tipo de categoría. Determina si la categoría aplica a ingresos o gastos.

| Valor     | Descripción          |
| --------- | -------------------- |
| `INCOME`  | Categoría de ingreso |
| `EXPENSE` | Categoría de gasto   |

**Uso:** campo `type` en `POST /categories` y filtro `?type=` en `GET /categories`.

---

## TransactionType

Tipo de transacción. Define cómo se comporta respecto al balance de la cuenta.

| Valor      | Efecto en balance                       | Descripción                              |
| ---------- | --------------------------------------- | ---------------------------------------- |
| `INCOME`   | Acredita (+) a la cuenta                | Ingreso de dinero                        |
| `EXPENSE`  | Debita (−) de la cuenta                 | Gasto de dinero                          |
| `TRANSFER` | Debita (−) origen, acredita (+) destino | Transferencia entre cuentas propias      |
| `DEBT`     | **Sin efecto**                          | Registro de deuda (le debemos a alguien) |
| `LOAN`     | **Sin efecto**                          | Registro de préstamo (alguien nos debe)  |

### Campos especiales por tipo

| Tipo     | `destinationAccountId` | `reference`   | `status`          | `remainingAmount` |
| -------- | ---------------------- | ------------- | ----------------- | ----------------- |
| INCOME   | —                      | opcional      | null              | null              |
| EXPENSE  | —                      | opcional      | null              | null              |
| TRANSFER | **requerido**          | opcional      | null              | null              |
| DEBT     | —                      | **requerido** | PENDING → SETTLED | monto pendiente   |
| LOAN     | —                      | **requerido** | PENDING → SETTLED | monto pendiente   |

**Uso:** campo `type` en `POST /transactions` y filtro `?type=` en `GET /transactions`.

---

## TransactionStatus

Estado de liquidación de una deuda o préstamo. Solo aplica cuando `type` es `DEBT` o `LOAN`.

| Valor     | Descripción                                                  |
| --------- | ------------------------------------------------------------ |
| `PENDING` | Pendiente — tiene saldo por liquidar (`remainingAmount > 0`) |
| `SETTLED` | Liquidada completamente — `remainingAmount = 0`              |

Para tipos INCOME, EXPENSE y TRANSFER, el campo `status` es siempre `null`.

**Uso:** filtro `?status=` en `GET /transactions` y campo en la respuesta.

---

## HabitFrequency

Frecuencia del hábito. Define cada cuánto se espera que el usuario lo complete.

| Valor    | Descripción                                        |
| -------- | -------------------------------------------------- |
| `DAILY`  | Se completa cada día                               |
| `WEEKLY` | Se completa X veces por semana                     |

**Uso:** campo `frequency` en `POST /habits` y `PATCH /habits/:id`.

---

## Language

Idioma de la interfaz del usuario.

| Valor | Descripción |
| ----- | ----------- |
| `es`  | Español     |
| `en`  | Inglés      |
| `pt`  | Portugués   |

**Default:** `es`

**Uso:** campo `language` en `PATCH /users/settings`.

---

## Theme

Tema visual de la aplicación.

| Valor    | Descripción                                |
| -------- | ------------------------------------------ |
| `light`  | Modo claro                                 |
| `dark`   | Modo oscuro                                |
| `system` | Sigue la preferencia del sistema operativo |

**Default:** `system`

**Uso:** campo `theme` en `PATCH /users/settings`.

---

## DateFormat

Formato de fecha preferido por el usuario.

| Valor        | Ejemplo    |
| ------------ | ---------- |
| `DD/MM/YYYY` | 15/03/2026 |
| `MM/DD/YYYY` | 03/15/2026 |
| `YYYY-MM-DD` | 2026-03-15 |

**Default:** `DD/MM/YYYY`

**Uso:** campo `dateFormat` en `PATCH /users/settings`. El frontend debe formatear las fechas según esta preferencia.

---

## StartOfWeek

Primer día de la semana para calendarios y vistas semanales.

| Valor    | Descripción |
| -------- | ----------- |
| `monday` | Lunes       |
| `sunday` | Domingo     |

**Default:** `monday`

**Uso:** campo `startOfWeek` en `PATCH /users/settings`.

---

## Timezone

IANA timezone identifier. String validado server-side con `Intl.DateTimeFormat`, no es un enum cerrado.

**Ejemplos válidos:** `America/Lima`, `Europe/Madrid`, `Asia/Tokyo`, `UTC`, `America/Argentina/Buenos_Aires`.

**Default:** `UTC` (para usuarios pre-existentes; el frontend auto-detecta la zona real en el primer login post-deploy).

**Uso:** campo `timezone` en `PATCH /users/settings`. Consumido por cálculos "por día" (cleanup de quick-tasks, rangos calendario-alineados en reports).

---

## ReportPeriod

Rango temporal aceptado por los endpoints de `/reports/*-dashboard`.

| Valor   | Semántica                                                                                  |
| ------- | ------------------------------------------------------------------------------------------ |
| `week`  | Últimos 7 días (deslizante, independiente de timezone)                                     |
| `30d`   | Últimos 30 días (deslizante, independiente de timezone)                                    |
| `month` | Mes calendario actual en la timezone del usuario, desde el 1° a las 00:00 locales          |
| `3m`    | Mes actual + los dos meses anteriores, desde el 1° del mes más antiguo a las 00:00 locales |

**Default:** `month`

**Uso:** query param `?period=...` en `GET /reports/finances-dashboard` y `GET /reports/routines-dashboard`.

---

## HabitFrequency

Frecuencia de un hábito (cómo se mide el progreso).

| Valor    | Descripción                                            |
| -------- | ------------------------------------------------------ |
| `DAILY`  | El target aplica por día (reset a medianoche del user) |
| `WEEKLY` | El target aplica por semana ISO (lunes a domingo)      |

**Uso:** campo `frequency` en `POST /habits` y `PATCH /habits/:id`.

---

## TransactionType

Tipo de transacción.

| Valor      | Descripción                                                                           |
| ---------- | ------------------------------------------------------------------------------------- |
| `INCOME`   | Ingreso. Suma al balance de la cuenta                                                 |
| `EXPENSE`  | Gasto. Resta del balance                                                              |
| `TRANSFER` | Transferencia entre cuentas propias (ambas deben compartir moneda)                    |
| `DEBT`     | Deuda: alguien te debe algo / tú debes algo. Requiere `reference`. No afecta balance  |
| `LOAN`     | Préstamo dado por ti. Requiere `reference`. No afecta balance                         |

Los settlements (liquidaciones) se crean como `EXPENSE` o `INCOME` con `relatedTransactionId` apuntando al DEBT/LOAN original.

---

## TransactionStatus

Estado de ciclo de vida para transacciones `DEBT` / `LOAN`.

| Valor     | Descripción                                                      |
| --------- | ---------------------------------------------------------------- |
| `PENDING` | Queda saldo por liquidar (`remainingAmount > 0`)                 |
| `SETTLED` | Completamente liquidada (`remainingAmount = 0`)                  |

Transacciones `INCOME` / `EXPENSE` / `TRANSFER` tienen `status=null`.
