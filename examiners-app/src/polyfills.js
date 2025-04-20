import { Buffer } from 'buffer'

// Add Buffer to global scope
if (typeof window !== 'undefined') {
  window.Buffer = Buffer
}