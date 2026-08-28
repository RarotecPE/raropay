// Script para limpar todos os arquivos do Vercel Blob Storage
import { list, del } from '@vercel/blob'

async function cleanupBlobs() {
  console.log('Iniciando limpeza do Blob Storage...')
  
  try {
    // Listar todos os blobs
    const { blobs } = await list()
    
    if (blobs.length === 0) {
      console.log('Nenhum arquivo encontrado no Blob Storage.')
      return
    }
    
    console.log(`Encontrados ${blobs.length} arquivo(s) para deletar.`)
    
    // Deletar cada blob
    for (const blob of blobs) {
      console.log(`Deletando: ${blob.pathname}`)
      await del(blob.url)
    }
    
    console.log(`\n${blobs.length} arquivo(s) deletado(s) com sucesso!`)
  } catch (error) {
    console.error('Erro ao limpar blobs:', error)
  }
}

cleanupBlobs()
