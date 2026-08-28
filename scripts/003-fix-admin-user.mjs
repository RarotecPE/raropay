import postgres from 'postgres'
import bcrypt from 'bcryptjs'

async function fixAdminUser() {
  const sql = postgres(process.env.DATABASE_CONNECTION, { prepare: false })
  
  // Hash da senha admin123
  const hashedPassword = await bcrypt.hash('admin123', 12)
  
  console.log('Atualizando usuário admin com senha criptografada...')
  
  // Atualizar ou inserir o usuário admin
  await sql`
    INSERT INTO users (name, email, password_hash, role)
    VALUES ('Administrador', 'admin@rarotec.com.br', ${hashedPassword}, 'diretoria')
    ON CONFLICT (email) 
    DO UPDATE SET password_hash = ${hashedPassword}
  `
  
  console.log('Usuário admin atualizado com sucesso!')
  console.log('E-mail: admin@rarotec.com.br')
  console.log('Senha: admin123')
}

fixAdminUser()
  .catch(console.error)
  .finally(() => process.exit())
