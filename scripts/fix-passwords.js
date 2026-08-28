import bcrypt from 'bcryptjs'
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_CONNECTION, { prepare: false })

async function fixPasswords() {
  // Gerar hash correto para senha 123456
  const password = '123456'
  const hash = await bcrypt.hash(password, 10)
  
  console.log('Hash gerado para senha 123456:', hash)
  
  // Atualizar todos os usuários com o novo hash
  await sql`UPDATE users SET password_hash = ${hash}`
  
  console.log('Senhas atualizadas com sucesso!')
  
  // Listar usuários
  const users = await sql`SELECT id, name, email, role FROM users`
  console.log('\nUsuários no sistema:')
  users.forEach(u => {
    console.log(`- ${u.name} (${u.email}) - ${u.role}`)
  })
}

fixPasswords()
  .catch(console.error)
  .finally(() => process.exit())
