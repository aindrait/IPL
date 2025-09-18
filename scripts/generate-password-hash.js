const bcrypt = require('bcryptjs');

async function generateHash() {
  const password = 'admin123';
  const hashedPassword = await bcrypt.hash(password, 12);
  console.log('Password:', password);
  console.log('Hashed Password:', hashedPassword);
}

generateHash().catch(console.error);