// Script para chamar a API de limpeza de blobs
const baseUrl = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : 'http://localhost:3000'

async function cleanup() {
  console.log('Chamando API de limpeza de blobs...')
  console.log('URL:', `${baseUrl}/api/cleanup-blobs`)
  
  try {
    const response = await fetch(`${baseUrl}/api/cleanup-blobs`, {
      method: 'DELETE'
    })
    
    const data = await response.json()
    console.log('Resultado:', JSON.stringify(data, null, 2))
  } catch (error) {
    console.error('Erro:', error.message)
  }
}

cleanup()
