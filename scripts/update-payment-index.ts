/*
  Update resident.paymentIndex based on prisma/Book2.csv
  CSV columns: INDEX,NO RUMAH,RT,NAMA
  Matching strategy: blok + houseNumber (+ RT if available)
  Also updates CSV with BLOK, NORUMAH, and SYNC columns
*/

import { promises as fs } from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type CsvRow = {
  indexValue: number
  noRumah: string
  rt: number | null
  name: string
  blok?: string
  houseNumber?: string
  sync?: number
}

function normalizeNoRumah(input: string): { blok: string; houseNumber: string } | null {
  if (!input) return null
  // Accept formats like: "C 10 / 1", "C 11/10", case-insensitive
  // Output should be: blok => "C11", houseNumber => "1"
  const match = input
    .trim()
    .match(/^\s*([A-Za-z]+)\s*([0-9]+)\s*\/\s*([0-9A-Za-z]+)\s*$/)
  if (!match) return null
  const blokLetter = match[1].toUpperCase()
  const blokNumber = match[2]
  const rawHouseNumber = match[3]
  // Normalize house number: strip leading zeros if purely numeric
  const numericMatch = rawHouseNumber.match(/^0*([0-9]+)$/)
  const houseNumber = numericMatch ? numericMatch[1] : rawHouseNumber
  const blok = `${blokLetter}${blokNumber}`
  return { blok, houseNumber }
}

async function parseCsv(filePath: string): Promise<CsvRow[]> {
  const content = await fs.readFile(filePath, 'utf8')
  const lines = content.split(/\r?\n/).filter(Boolean)
  const rows: CsvRow[] = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (i === 0 && /INDEX/i.test(line) && /NO RUMAH/i.test(line)) continue // header
    
    // Parse CSV line properly handling quoted fields
    const cols: string[] = []
    let current = ''
    let inQuotes = false
    let j = 0
    
    while (j < line.length) {
      const char = line[j]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        cols.push(current.trim())
        current = ''
      } else {
        current += char
      }
      j++
    }
    cols.push(current.trim()) // Add the last column
    
    if (cols.length < 4) continue
    
    const indexValue = parseInt(cols[0].trim(), 10)
    const noRumah = cols[1].replace(/"/g, '').trim()
    const rt = cols[2] ? parseInt(cols[2].trim(), 10) : null
    const name = cols[3].replace(/"/g, '').trim()
    
    if (!Number.isFinite(indexValue)) continue
    
    // Parse blok and houseNumber from noRumah
    const parsed = normalizeNoRumah(noRumah)
    const blok = parsed?.blok || ''
    const houseNumber = parsed?.houseNumber || ''
    
    rows.push({ 
      indexValue, 
      noRumah, 
      rt: Number.isFinite(rt) ? rt : null, 
      name,
      blok,
      houseNumber,
      sync: 0 // Default to 0, will be updated to 1 if matched
    })
  }
  return rows
}

async function writeCsv(filePath: string, rows: CsvRow[]): Promise<void> {
  const header = 'INDEX,NO RUMAH,RT,NAMA,BLOK,NORUMAH,SYNC'
  const csvLines = [header]
  
  for (const row of rows) {
    const line = [
      row.indexValue,
      `"${row.noRumah}"`,
      row.rt || '',
      `"${row.name}"`,
      row.blok || '',
      row.houseNumber || '',
      row.sync || 0
    ].join(',')
    csvLines.push(line)
  }
  
  await fs.writeFile(filePath, csvLines.join('\r\n'), 'utf8')
}

async function getOrCreateSystemUser() {
  let systemUser = await prisma.user.findFirst({
    where: { email: 'system@localhost' }
  })

  if (!systemUser) {
    systemUser = await prisma.user.create({
      data: {
        email: 'system@localhost',
        name: 'System User',
        role: 'ADMIN',
        password: 'system-password-123'
      }
    })
    console.log('Created system user:', systemUser.id)
  }

  return systemUser
}

async function createResidentFromCsvRow(row: CsvRow, systemUserId: string): Promise<void> {
  // Generate unique phone number based on blok and house number
  const phoneSuffix = `${row.blok}${row.houseNumber}`.replace(/[^0-9]/g, '')
  const phone = `08${phoneSuffix.padStart(8, '0').slice(0, 8)}`
  
  // Generate address
  const address = `${row.blok} No. ${row.houseNumber}`
  
  // Determine RW (assume RW 1 for all)
  const rw = 1

  try {
    await prisma.resident.create({
      data: {
        name: row.name,
        address,
        phone,
        rt: row.rt || 1,
        rw,
        blok: row.blok,
        houseNumber: row.houseNumber,
        paymentIndex: row.indexValue,
        createdById: systemUserId,
        isActive: true
      }
    })
    console.log(`Created resident: ${row.name} (${row.blok}/${row.houseNumber})`)
  } catch (error) {
    console.error(`Failed to create resident ${row.name}:`, error)
    throw error
  }
}

async function main() {
  const csvPath = path.join(process.cwd(), 'prisma', 'Book2.csv')
  const rows = await parseCsv(csvPath)
  let updated = 0
  let notFound = 0
  let conflicts = 0
  let created = 0

  // Get or create system user for creating residents
  const systemUser = await getOrCreateSystemUser()

  for (const row of rows) {
    const parsed = normalizeNoRumah(row.noRumah)
    if (!parsed) { 
      notFound++
      continue 
    }
    const { blok, houseNumber } = parsed
    
    // Update the row's blok and houseNumber
    row.blok = blok
    row.houseNumber = houseNumber
    
    // Try to find resident by blok & houseNumber (& optional rt)
    const where: any = {
      blok,
      houseNumber,
    }
    if (row.rt && Number.isFinite(row.rt)) {
      where.rt = row.rt
    }

    const matches = await prisma.resident.findMany({ where, select: { id: true, paymentIndex: true, name: true, rt: true } })
    if (matches.length === 0) {
      // Fallback: ignore RT and try again if RT was specified
      if (where.rt) {
        const fallbackMatches = await prisma.resident.findMany({ where: { blok, houseNumber }, select: { id: true, paymentIndex: true, name: true, rt: true } })
        if (fallbackMatches.length === 0) {
          // Create new resident for this row
          try {
            await createResidentFromCsvRow(row, systemUser.id)
            created++
            row.sync = 1 // Mark as synced
          } catch (error) {
            notFound++
            console.error(`Failed to create resident for ${row.name}:`, error)
          }
          continue
        }
        if (fallbackMatches.length > 1) {
          conflicts++
          continue
        }
        const res = fallbackMatches[0]
        await prisma.resident.update({ where: { id: res.id }, data: { paymentIndex: row.indexValue } })
        updated++
        row.sync = 1 // Mark as synced
      } else {
        // Create new resident for this row
        try {
          await createResidentFromCsvRow(row, systemUser.id)
          created++
          row.sync = 1 // Mark as synced
        } catch (error) {
          notFound++
          console.error(`Failed to create resident for ${row.name}:`, error)
        }
      }
    } else if (matches.length > 1) {
      conflicts++
    } else {
      const res = matches[0]
      if (res.paymentIndex !== row.indexValue) {
        await prisma.resident.update({ where: { id: res.id }, data: { paymentIndex: row.indexValue } })
      }
      updated++
      row.sync = 1 // Mark as synced
    }
  }

  // Write updated CSV back to file
  await writeCsv(csvPath, rows)

  console.log(JSON.stringify({ totalRows: rows.length, updated, notFound, conflicts, created }, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })


