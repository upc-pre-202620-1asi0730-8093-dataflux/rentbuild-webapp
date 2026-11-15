# Migración Angular a Vue - RentBuild

## Referencias verificadas

- ZIP Angular: maquigest-webapp-develop.zip, SHA-256 4ebd1420db4da7b4300921a7aa01fea7e0de65d2d914b5188b730d27dc7040d0.
- Vue: https://github.com/upc-pre-202620-1asi0730-8093-dataflux/rentbuild-webapp
- Rama base: main; commit 7a86d6d352eba49b70909480bc369a9827396acf. GitHub conectado fue consultado.
- Fecha de revisión: 12 de noviembre de 2026, America/Lima.

## Cambios adaptados

| Angular suministrado | Implementación Vue | Resultado |
| --- | --- | --- |
| iam/password-recovery y recover-password | iam/application, infrastructure y RecoverPassword.vue | Solicitud al backend y estados de envío/error |
| equipment-api-endpoint, equipment-assembler | inventory/infrastructure | Consulta de disponibilidad y final inclusivo del día |
| rental-request-rescheduling.policy y rental-request-detail | rentals/domain, application y RentalRequestDetail.vue | Edición de período de solicitudes propias pendientes |
| rental-lifecycle-date.policy | rentals/domain y OperationForm.vue | Calendario Lima; entregas dentro del contrato y devoluciones tardías permitidas |
| equipment-history, endpoint y assembler | maintenance/application, infrastructure y EquipmentHistory.vue | Historial de alquileres, incidencias y mantenimientos |
| maintenance-list y maintenance-completion-dialog | MaintenanceList.vue y maintenance.store.js | Filtros y actualización del mismo mantenimiento con técnico/observaciones |
| incident.store y reactivateEquipment | maintenance/application e infrastructure | Solicitud de reactivación al servidor; no se habilita el equipo directamente desde el navegador |
| cancelCurrentSubscription | subscriptions/application e infrastructure, Plans.vue | Cancelación confirmada y eliminación del derecho activo en memoria |
| dashboard | shared/presentation/views/dashboard/Dashboard.vue | Resumen de datos reales por cuenta, sin escrituras |

Se conserva Vue 3, Pinia, Vue Router, PrimeVue, RxJS, arquitectura por dominio/aplicación/infraestructura/presentación, marca RentBuild y precios con moneda. No se incluye código Angular en el proyecto entregado.

## Ejecutar la entrega completa

Desde rentbuild-webapp, con Node >=22.18:

```powershell
npm ci
npm run dev:mock
```

Abrir http://127.0.0.1:5173. Registrar cuentas desde la aplicación: los datos de demostración se entregan vacíos. Elegir empresa arrendadora o constructora. El plan Growth (ID 3) habilita mantenimiento en la demo; no procesa pagos.

Para backend real, crear .env.local con VITE_USE_FAKE_API=false y VITE_API_BASE_URL apuntando a la raíz /api/v1 de su servidor. No incluir secretos de correo en Vue.

## Contratos nuevos o ampliados

- POST /authentication/password-recovery, cuerpo {email}. El correo/tokens pertenecen al backend; la demo devuelve 501 y la UI lo informa.
- GET /equipment/{id}/availability?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD, respuesta {available:boolean}.
- PATCH /rental-requests/{id}/period, cuerpo {startDate,endDate} en ISO. Devuelve el mismo recurso; 400/422 período inválido, 403 sin permiso, 404 ausente, 409 conflicto.
- GET /maintenances/equipment/{id}/history, proyección {equipmentId,equipmentCode,equipmentName,entries:[{id,kind,occurredAt,description,status}]}.
- PATCH /maintenances/{id}, cuerpo {status:'COMPLETED',technician,acknowledge:false,notes}; actualiza el agregado existente.
- POST /incidents/equipment/{id}/reactivate, cuerpo {inspectionConfirmed:true}. El servidor verifica incidencias, alquiler activo y trabajos pendientes.
- PATCH /user-subscriptions/{id}/cancel, cuerpo {}; devuelve estado CANCELLED.
- La API demo sincroniza bloqueo de inventario al crear o restringir una incidencia.

## Validación ejecutada

- npm ci --no-audit --no-fund: correcto.
- npm run build: correcto, 1009 módulos transformados.
- npm test: 14 archivos y 114 pruebas aprobadas (96 existentes + 18 nuevas).
- npm run test:e2e: 3 escenarios aprobados; registro/perfil de ambos roles y flujo migrado integral.
- El escenario migrado verifica persistencia del ID y fechas, rechazo por rol/estado, cierre del mismo mantenimiento, historial ajeno rechazado, bloqueo de reactivación, disponibilidad, cancelación y recuperación sin proveedor.
- Las pruebas usan .test-runtime/db.json y no modifican server/db.json.

La validación se realizó contra la API de demostración incluida, no contra una instancia Spring Boot de producción. La autorización y transacciones reales corresponden al backend. json-server y los tokens numéricos son exclusivamente para desarrollo local.

## Cinco integrantes

Los parches de cambios son disjuntos por archivo y se calculan contra la base indicada. No contienen autoría ni commits creados. Cada integrante debe revisar su cambio, hacer su commit con su identidad y abrir su pull request. La app final requiere integrar los cinco grupos: los módulos usan las rutas, traducciones y API demo del grupo 05. No evaluar como entrega completa una rama aislada.

Consultar el PDF y el manifiesto JSON externo para archivos exactos, ramas, mensajes sugeridos y pasos de integración. Los parches se aplican a un clon limpio del repositorio base, no a esta carpeta ya corregida.
