const fs = require('fs');
const path = require('path');

// Get all ticket files
const ticketDir = 'tests/bug-reports';
const files = fs.readdirSync(ticketDir).filter(f => f.endsWith('.json'));

let openCount = 0;
let resolvedCount = 0;
let inProgressCount = 0;
let totalCount = files.length;

console.log('Current Ticket Status:');
console.log('========================');

const openTickets = [];

files.forEach(file => {
  try {
    const content = JSON.parse(fs.readFileSync(path.join(ticketDir, file), 'utf8'));
    const status = content.status || 'open';
    
    if (status === 'open') {
      openCount++;
      openTickets.push({
        id: content.id,
        title: content.title || 'No title',
        type: content.type || 'unknown'
      });
    } else if (status === 'resolved') {
      resolvedCount++;
    } else if (status === 'in-progress') {
      inProgressCount++;
    }
  } catch (e) {
    console.log(`Error reading ${file}: ${e.message}`);
  }
});

console.log('\nOpen Tickets:');
openTickets.forEach(ticket => {
  console.log(`- ${ticket.id} [${ticket.type}]: ${ticket.title}`);
});

console.log('\nSummary:');
console.log(`Total: ${totalCount}`);
console.log(`Open: ${openCount}`);
console.log(`In Progress: ${inProgressCount}`);
console.log(`Resolved: ${resolvedCount}`); 