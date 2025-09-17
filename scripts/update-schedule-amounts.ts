/*
  Update PaymentScheduleItem amounts to 250000
  This script updates all payment schedule items to use the correct IPL amount
*/

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting PaymentScheduleItem amount update...')
  
  try {
    // Get all payment schedule items
    const items = await prisma.paymentScheduleItem.findMany({
      select: {
        id: true,
        amount: true,
        label: true,
        type: true
      }
    })
    
    console.log(`Found ${items.length} payment schedule items`)
    
    // Update all items to 250000
    const updateResult = await prisma.paymentScheduleItem.updateMany({
      data: {
        amount: 250000
      }
    })
    
    console.log(`Updated ${updateResult.count} payment schedule items to amount 250000`)
    
    // Show some examples of updated items
    const sampleItems = await prisma.paymentScheduleItem.findMany({
      take: 5,
      select: {
        id: true,
        amount: true,
        label: true,
        type: true
      }
    })
    
    console.log('\nSample updated items:')
    sampleItems.forEach(item => {
      console.log(`- ${item.label || 'No label'} (${item.type}): ${item.amount}`)
    })
    
    console.log('\n✅ PaymentScheduleItem amounts updated successfully!')
    
  } catch (error) {
    console.error('❌ Error updating payment schedule items:', error)
    throw error
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
