import {
  DeleteObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3"

function requiredEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Variavel de ambiente ${name} nao configurada`)
  return value
}

const endpoint = requiredEnv("R2_ENDPOINT").replace(/\/+$/, "")
const bucket = requiredEnv("R2_BUCKET")
const basePrefix = (process.env.R2_BASE_PREFIX ?? "").trim().replace(/^\/+|\/+$/g, "")

const client = new S3Client({
  region: "auto",
  endpoint,
  credentials: {
    accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
  },
  forcePathStyle: true,
})

async function listFiles() {
  let continuationToken
  const files = []

  do {
    const response = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: basePrefix ? `${basePrefix}/` : undefined,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    }))

    files.push(...(response.Contents ?? []).filter((object) => object.Key))
    continuationToken = response.NextContinuationToken
  } while (continuationToken)

  return files
}

async function cleanupR2() {
  console.log("Iniciando limpeza do Cloudflare R2...")
  console.log(`Bucket: ${bucket}`)
  console.log(`Prefixo: ${basePrefix || "(raiz)"}`)

  try {
    const files = await listFiles()

    if (files.length === 0) {
      console.log("Nenhum arquivo encontrado no R2.")
      return
    }

    console.log(`Encontrados ${files.length} arquivo(s) para deletar.`)

    for (const file of files) {
      console.log(`Deletando: ${file.Key}`)
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: file.Key }))
    }

    console.log(`\n${files.length} arquivo(s) deletado(s) com sucesso!`)
  } catch (error) {
    console.error("Erro ao limpar R2:", error)
  }
}

cleanupR2()
