export interface ExportZoneData {
  id: number
  name: string
  type: string
  comment: string | null
  created_at?: string
  records?: Array<{
    name: string
    type: string
    value: string
    ttl: number
    priority?: number | null
    weight?: number | null
    port?: number | null
  }>
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportZoneAsJSON(zone: ExportZoneData, records?: ExportZoneData["records"]) {
  const data = {
    hosted_zone: {
      id: zone.id,
      name: zone.name,
      type: zone.type,
      comment: zone.comment,
      created_at: zone.created_at,
    },
    records: records || zone.records || [],
    exported_at: new Date().toISOString(),
    generator: "AWS Route 53 Console Clone",
  }

  const jsonStr = JSON.stringify(data, null, 2)
  const cleanName = zone.name.replace(/\.$/, "")
  downloadFile(jsonStr, `${cleanName}-records.json`, "application/json")
}

export function exportMultipleZonesAsJSON(zones: ExportZoneData[]) {
  const data = {
    hosted_zones: zones,
    total: zones.length,
    exported_at: new Date().toISOString(),
    generator: "AWS Route 53 Console Clone",
  }

  const jsonStr = JSON.stringify(data, null, 2)
  downloadFile(jsonStr, `route53-hosted-zones-${new Date().toISOString().slice(0, 10)}.json`, "application/json")
}

export function exportZoneAsBIND(zone: ExportZoneData, records: Array<{
  name: string
  type: string
  value: string
  ttl: number
  priority?: number | null
  weight?: number | null
  port?: number | null
}>) {
  const zoneName = zone.name.endsWith(".") ? zone.name : `${zone.name}.`
  let bindText = `; ===================================================================\n`
  bindText += `; BIND Zone File for ${zoneName}\n`
  bindText += `; Exported from AWS Route 53 Console Clone at ${new Date().toISOString()}\n`
  bindText += `; Type: ${zone.type} Hosted Zone\n`
  if (zone.comment) {
    bindText += `; Description: ${zone.comment}\n`
  }
  bindText += `; ===================================================================\n\n`
  bindText += `$ORIGIN ${zoneName}\n`
  bindText += `$TTL 300\n\n`

  for (const rec of records) {
    const formattedName = rec.name.endsWith(".") ? rec.name : `${rec.name}.`
    const padName = formattedName.padEnd(30, " ")
    const padTtl = String(rec.ttl).padEnd(8, " ")
    const padType = rec.type.padEnd(8, " ")

    if (rec.type === "MX") {
      const prio = rec.priority != null ? String(rec.priority) : "10"
      bindText += `${padName} ${padTtl} IN ${padType} ${prio} ${rec.value}\n`
    } else if (rec.type === "SRV") {
      const prio = rec.priority != null ? String(rec.priority) : "0"
      const weight = rec.weight != null ? String(rec.weight) : "0"
      const port = rec.port != null ? String(rec.port) : "80"
      bindText += `${padName} ${padTtl} IN ${padType} ${prio} ${weight} ${port} ${rec.value}\n`
    } else if (rec.type === "TXT") {
      const txtVal = rec.value.startsWith('"') && rec.value.endsWith('"') ? rec.value : `"${rec.value}"`
      bindText += `${padName} ${padTtl} IN ${padType} ${txtVal}\n`
    } else {
      bindText += `${padName} ${padTtl} IN ${padType} ${rec.value}\n`
    }
  }

  const cleanName = zone.name.replace(/\.$/, "")
  downloadFile(bindText, `${cleanName}.zone`, "text/plain")
}
