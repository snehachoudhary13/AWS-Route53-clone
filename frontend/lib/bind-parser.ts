export interface ParsedRecord {
  name: string
  type: string
  value: string
  ttl: number
  priority?: number | null
  weight?: number | null
  port?: number | null
}

export interface ParseBindResult {
  records: ParsedRecord[]
  origin?: string
  ttl?: number
  errors: string[]
}

export function parseBindZone(content: string, defaultZoneName: string): ParseBindResult {
  const lines = content.split(/\r?\n/)
  const records: ParsedRecord[] = []
  const errors: string[] = []

  let currentOrigin = defaultZoneName.endsWith(".") ? defaultZoneName : `${defaultZoneName}.`
  let currentTtl = 300
  let lastRecordName = "@"

  // Preprocess: remove comments and join multiline parentheses
  let fullCleaned = ""
  let inParen = false

  for (const rawLine of lines) {
    // strip inline comment unless inside quotes
    let line = ""
    let inQuote = false
    for (let i = 0; i < rawLine.length; i++) {
      const char = rawLine[i]
      if (char === '"') inQuote = !inQuote
      if (char === ';' && !inQuote) break
      line += char
    }

    line = line.trim()
    if (!line) continue

    if (line.includes("(") && !inParen) {
      inParen = true
      fullCleaned += " " + line.replace("(", " ")
      if (line.includes(")")) {
        inParen = false
        fullCleaned = fullCleaned.replace(")", " ") + "\n"
      }
    } else if (inParen) {
      if (line.includes(")")) {
        inParen = false
        fullCleaned += " " + line.replace(")", " ") + "\n"
      } else {
        fullCleaned += " " + line
      }
    } else {
      fullCleaned += line + "\n"
    }
  }

  const cleanedLines = fullCleaned.split("\n").map((l) => l.trim()).filter(Boolean)

  for (let lineIndex = 0; lineIndex < cleanedLines.length; lineIndex++) {
    const line = cleanedLines[lineIndex]

    // Check for directives
    if (line.toUpperCase().startsWith("$ORIGIN")) {
      const parts = line.split(/\s+/)
      if (parts[1]) {
        currentOrigin = parts[1].endsWith(".") ? parts[1] : `${parts[1]}.`
      }
      continue
    }

    if (line.toUpperCase().startsWith("$TTL")) {
      const parts = line.split(/\s+/)
      const parsedTtl = parseInt(parts[1], 10)
      if (!isNaN(parsedTtl)) {
        currentTtl = parsedTtl
      }
      continue
    }

    // Parse resource record
    const tokens = line.split(/\s+/)
    if (tokens.length < 2) continue

    let name = ""
    let ttl = currentTtl
    let rType = ""
    let tokenIdx = 0

    // Check if first token is record name
    const validTypes = ["A", "AAAA", "CNAME", "TXT", "MX", "NS", "PTR", "SRV", "CAA", "SOA"]
    
    // If line starts with a type directly or whitespace inherited name
    if (validTypes.includes(tokens[0].toUpperCase()) || tokens[0].toUpperCase() === "IN") {
      name = lastRecordName
    } else {
      name = tokens[tokenIdx++]
      lastRecordName = name
    }

    // Optional TTL or class (IN)
    while (tokenIdx < tokens.length) {
      const tok = tokens[tokenIdx].toUpperCase()
      if (tok === "IN") {
        tokenIdx++
        continue
      }
      const num = parseInt(tok, 10)
      if (!isNaN(num) && tokenIdx < tokens.length - 1 && !validTypes.includes(tok)) {
        ttl = num
        tokenIdx++
        continue
      }
      if (validTypes.includes(tok)) {
        rType = tok
        tokenIdx++
        break
      }
      tokenIdx++
    }

    if (!rType) {
      continue // Skip unrecognized lines or unsupported records
    }

    if (rType === "SOA") {
      // Typically auto-generated, but can be imported if needed
      continue
    }

    const valueTokens = tokens.slice(tokenIdx)
    const rawValue = valueTokens.join(" ")

    let parsedPriority: number | null = null
    let parsedWeight: number | null = null
    let parsedPort: number | null = null
    let recordValue = rawValue

    if (rType === "MX") {
      if (valueTokens.length >= 2) {
        parsedPriority = parseInt(valueTokens[0], 10) || 10
        recordValue = valueTokens.slice(1).join(" ")
      }
    } else if (rType === "SRV") {
      if (valueTokens.length >= 4) {
        parsedPriority = parseInt(valueTokens[0], 10) || 0
        parsedWeight = parseInt(valueTokens[1], 10) || 0
        parsedPort = parseInt(valueTokens[2], 10) || 80
        recordValue = valueTokens.slice(3).join(" ")
      }
    }

    // Format Name relative / absolute properly
    let formattedName = name
    if (formattedName === "@") {
      formattedName = currentOrigin
    } else if (!formattedName.endsWith(".")) {
      formattedName = `${formattedName}.${currentOrigin}`
    }

    records.push({
      name: formattedName,
      type: rType,
      value: recordValue,
      ttl: ttl || currentTtl,
      priority: parsedPriority,
      weight: parsedWeight,
      port: parsedPort,
    })
  }

  return {
    records,
    origin: currentOrigin,
    ttl: currentTtl,
    errors,
  }
}
