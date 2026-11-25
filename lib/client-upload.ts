'use client'

const FIVE_MB = 5 * 1024 * 1024
const TEN_MB = 10 * 1024 * 1024
const SAFE_DIRECT_FORM_LIMIT = Math.floor(3.5 * 1024 * 1024) // 3.5MB (abaixo do limite de 4.5MB da Vercel)
const CHUNK_SIZE = Math.floor(2.5 * 1024 * 1024) // 2.5MB por chunk

export interface UploadResult {
  pathname: string
  url: string
  file_name: string
  file_path: string
  file_type: string
  file_size: number
}

async function parseJsonResponse(response: Response, fallbackMessage = 'Erro ao fazer upload') {
  if (response.status === 413) {
    throw new Error('O arquivo enviado excedeu o limite de tamanho da requisição.')
  }

  const text = await response.text()
  let data: any = null
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new Error(response.ok ? fallbackMessage : `${fallbackMessage} (HTTP ${response.status})`)
  }

  if (!response.ok) {
    throw new Error(data?.error || fallbackMessage)
  }

  return data
}

/**
 * Quando o arquivo for uma imagem e exceder 5MB, comprime via Canvas
 * para ocupar menos espaço no storage (Cloudflare R2) e acelerar o envio.
 */
export async function compressImageIfExceeds5MB(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= FIVE_MB) {
    return file
  }

  // GIFs animados não devem ser re-encodados via canvas estático
  if (file.type === 'image/gif') {
    return file
  }

  return new Promise<File>((resolve) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      try {
        const maxDimension = 2048
        let { width, height } = img

        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width)
            width = maxDimension
          } else {
            width = Math.round((width * maxDimension) / height)
            height = maxDimension
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          resolve(file)
          return
        }

        // Fundo branco para evitar transparência preta ao converter PNG para JPEG
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)

        const outputType = 'image/jpeg'
        const baseName = file.name.replace(/\.[^.]+$/, '') || 'imagem'
        const newFileName = `${baseName}.jpg`

        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              resolve(file)
              return
            }
            const compressedFile = new File([blob], newFileName, {
              type: outputType,
              lastModified: Date.now(),
            })
            resolve(compressedFile)
          },
          outputType,
          0.82
        )
      } catch {
        resolve(file)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(file)
    }

    img.src = objectUrl
  })
}

/**
 * Faz o upload do arquivo utilizando Presigned URL do Cloudflare R2 (Opção 1)
 * com compressão automática para imagens > 5MB e fallback em chunks caso o CORS
 * do bucket bloqueie o PUT direto do navegador.
 */
export async function uploadFileToR2(
  rawFile: File,
  endpoint: '/api/upload' | '/api/invoice-analysis/upload' = '/api/upload'
): Promise<UploadResult> {
  if (rawFile.size > TEN_MB && !rawFile.type.startsWith('image/')) {
    throw new Error('Arquivo muito grande. Tamanho máximo: 10MB.')
  }

  // 1. Se for imagem > 5MB, comprime antes do upload para economizar espaço no storage
  const file = await compressImageIfExceeds5MB(rawFile)

  if (file.size > TEN_MB) {
    throw new Error('Arquivo muito grande mesmo após otimização. Tamanho máximo: 10MB.')
  }

  // 2. Solicita Presigned URL à API (payload leve em JSON)
  const presignResponse = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'presign',
      fileName: file.name,
      fileType: file.type || 'application/octet-stream',
      fileSize: file.size,
    }),
  })

  const presignData = await parseJsonResponse(presignResponse, 'Erro ao preparar upload')

  // 3. Tenta upload direto ao Cloudflare R2 via Presigned URL
  if (presignData.uploadUrl) {
    try {
      const directPut = await fetch(presignData.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
      })

      if (directPut.ok) {
        return {
          pathname: presignData.pathname,
          url: presignData.url,
          file_name: file.name,
          file_path: presignData.pathname,
          file_type: file.type,
          file_size: file.size,
        }
      }
    } catch {
      // Se o navegador bloquear por CORS no bucket R2, segue para o fallback seguro abaixo
    }
  }

  // 4. Fallback A: Arquivo <= 3.5MB (inclui imagens comprimidas) -> envio direto via FormData
  if (file.size <= SAFE_DIRECT_FORM_LIMIT) {
    const formData = new FormData()
    formData.append('file', file)
    const directRes = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    })
    const data = await parseJsonResponse(directRes, 'Erro ao fazer upload')
    const pathname = data.pathname || data.file_path
    return {
      pathname,
      url: data.url || `/api/file?pathname=${encodeURIComponent(pathname)}`,
      file_name: data.file_name || file.name,
      file_path: pathname,
      file_type: data.file_type || file.type,
      file_size: data.file_size || file.size,
    }
  }

  // 5. Fallback B: Arquivo entre 3.5MB e 10MB (ex.: PDF grande sem CORS no bucket) -> envio fatiado em chunks de 2.5MB
  const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE)

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, file.size)
    const chunkBlob = file.slice(start, end, file.type || 'application/octet-stream')

    const chunkForm = new FormData()
    chunkForm.append('action', 'chunk')
    chunkForm.append('uploadId', uploadId)
    chunkForm.append('chunkIndex', String(chunkIndex))
    chunkForm.append('chunk', chunkBlob, `chunk-${chunkIndex}`)

    const chunkRes = await fetch(endpoint, {
      method: 'POST',
      body: chunkForm,
    })
    await parseJsonResponse(chunkRes, `Falha ao enviar parte ${chunkIndex + 1} de ${totalChunks}`)
  }

  const completeRes = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'complete',
      uploadId,
      totalChunks,
      fileName: file.name,
      fileType: file.type || 'application/octet-stream',
      fileSize: file.size,
    }),
  })

  const completeData = await parseJsonResponse(completeRes, 'Erro ao finalizar upload do arquivo')
  const finalPathname = completeData.pathname || completeData.file_path

  return {
    pathname: finalPathname,
    url: completeData.url || `/api/file?pathname=${encodeURIComponent(finalPathname)}`,
    file_name: completeData.file_name || file.name,
    file_path: finalPathname,
    file_type: completeData.file_type || file.type,
    file_size: completeData.file_size || file.size,
  }
}
