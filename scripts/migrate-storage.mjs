import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const target = process.argv[2]
if (!existsSync(target)) {
  console.log(`skip: ${target} not found`)
  process.exit(0)
}
const data = JSON.parse(readFileSync(target, 'utf8'))
let removed = 0
for (const message of Object.values(data.tables?.messages ?? {})) {
  if (message && 'attachments' in message) {
    delete message.attachments
    removed += 1
  }
}
if (data.tables?.operations) delete data.tables.operations
writeFileSync(target, JSON.stringify(data, null, 2))
console.log(`${target}: removed ${removed} attachments field(s)`)
