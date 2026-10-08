AeroTrace Vercel integration patch

Copy files:
  schema.ts -> lib/db/schema.ts (MERGE the added exports if your project already defines these tables elsewhere)
  telemetry-route.ts -> app/api/telemetry/route.ts
  telemetry-latest-route.ts -> app/api/telemetry/latest/route.ts
  node-details-panel.tsx -> components/map/node-details-panel.tsx

In the parent that renders NodeDetailsPanel, pass deviceId="aerotrace-001" on the matching node.
Set AEROTRACE_DEVICE_TOKEN in Vercel, match it on ESP32, and apply Drizzle migrations.

IMPORTANT
1. The uploaded schema was missing telemetryReadings and deviceCommands exports. If they already exist in a different source file or branch, merge rather than duplicate.
2. Your earlier firmware's sequenceNumber uses millis(); that can repeat after reboot, causing unique-index deduplication. Change device sequencing to a persistent monotonic counter, or device boot ID plus counter, before production.
3. The firmware may send unsynced timestamps; the API uses server receive time in that case.
4. Your A7670E AT+HTTPACTION errors remain unresolved. These backend changes do not establish cellular internet access.
5. GPIO and SHT45/GP2Y hardware faults remain unresolved.
6. Model provenance defaults to unclassified unless a model is identified; even identified Random Forest predictions remain unverified until validated. AP B1/B2/B3 actions must transmit explicit manual-test metadata.
7. User-facing WAQI remains separate from onboard pH/EC/GNSS readings. Never convert GP2Y raw voltage to PM2.5 by simply multiplying by 1000.
8. Existing route structure for device commands must be aligned with firmware, e.g. app/api/dev/[deviceId]/route.ts and app/api/commands/[id]/route.ts.
9. Authenticated dashboard GET relies on isAdminLoggedIn.
10. Node ID and device ID are not necessarily the same; provide the correct deviceId prop when rendering panel.
11. These patches were source-reviewed only; install project dependencies and run TypeScript/build and Drizzle migration locally.
