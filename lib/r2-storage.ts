import "server-only"

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type _Object,
} from "@aws-sdk/client-s3"

type R2ObjectBody = {
  transformToWebStream?: () => ReadableStream
  transformToByteArray?: () => Promise<Uint8Array>
}

export interface StoredFile {
  pathname: string
  url: string
  contentType: string
  etag?: string
  size?: number
  stream: ReadableStream
}

let client: S3Client | null = null

function requiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Variavel de ambiente ${name} nao configurada`)
  }
  return value
}

function getConfig() {
  return {
    endpoint: requiredEnv("R2_ENDPOINT").replace(/\/+$/, ""),
    bucket: requiredEnv("R2_BUCKET"),
    accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
    basePrefix: (process.env.R2_BASE_PREFIX ?? "").trim().replace(/^\/+|\/+$/g, ""),
  }
}

function getClient() {
  const config = getConfig()
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
    })
  }
  return client
}

function normalizePathname(pathname: string) {
  const decoded = decodeURIComponent(pathname.trim())

  if (decoded.includes(".blob.vercel-storage.com/")) {
    return decoded.match(/\.blob\.vercel-storage\.com\/(.+)$/)?.[1]?.split("?")[0] ?? decoded
  }

  if (decoded.startsWith("http://") || decoded.startsWith("https://")) {
    return new URL(decoded).pathname.replace(/^\/+/, "")
  }

  return decoded.replace(/^\/+/, "").split("?")[0]
}

function storageKey(pathname: string) {
  const config = getConfig()
  const normalized = normalizePathname(pathname)

  if (!config.basePrefix || normalized === config.basePrefix || normalized.startsWith(`${config.basePrefix}/`)) {
    return normalized
  }

  return `${config.basePrefix}/${normalized}`
}

function publicUrlForPathname(pathname: string) {
  return `/api/file?pathname=${encodeURIComponent(pathname)}`
}

function invoiceAnalysisAliases(pathname: string) {
  const normalized = normalizePathname(pathname)
  const aliases = new Set([normalized])

  if (normalized.startsWith("invoice-analysis/")) {
    aliases.add(normalized.replace(/^invoice-analysis\//, "invoices-analisys/"))
    aliases.add(normalized.replace(/^invoice-analysis\//, "invoices-analysis/"))
  }

  if (normalized.startsWith("invoices-analisys/") || normalized.startsWith("invoices-analysis/")) {
    aliases.add(normalized.replace(/^invoices-analisys\//, "invoice-analysis/"))
    aliases.add(normalized.replace(/^invoices-analysis\//, "invoice-analysis/"))
  }

  return Array.from(aliases)
}

function isNotFoundError(error: unknown) {
  if (!(error instanceof Error)) return false
  const statusCode = (error as Error & { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
  return statusCode === 404 || ["NoSuchKey", "NotFound"].includes(error.name)
}

async function bodyToWebStream(body: R2ObjectBody | undefined): Promise<ReadableStream> {
  if (!body) {
    return new ReadableStream()
  }

  if (body.transformToWebStream) {
    return body.transformToWebStream()
  }

  if (body.transformToByteArray) {
    const bytes = await body.transformToByteArray()
    return new Blob([bytes]).stream()
  }

  throw new Error("Formato de stream R2 nao suportado")
}

export async function putFile(pathname: string, file: File) {
  const normalized = normalizePathname(pathname)
  await getClient().send(new PutObjectCommand({
    Bucket: getConfig().bucket,
    Key: storageKey(normalized),
    Body: Buffer.from(await file.arrayBuffer()),
    ContentType: file.type || "application/octet-stream",
  }))

  return {
    pathname: normalized,
    url: publicUrlForPathname(normalized),
  }
}

export async function getFile(pathname: string): Promise<StoredFile | null> {
  const aliases = invoiceAnalysisAliases(pathname)

  for (const alias of aliases) {
    try {
      const result = await getClient().send(new GetObjectCommand({
        Bucket: getConfig().bucket,
        Key: storageKey(alias),
      }))

      return {
        pathname: alias,
        url: publicUrlForPathname(alias),
        contentType: result.ContentType ?? "application/octet-stream",
        etag: result.ETag ?? undefined,
        size: result.ContentLength ?? undefined,
        stream: await bodyToWebStream(result.Body as R2ObjectBody | undefined),
      }
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error
      }
    }
  }

  return null
}

export async function headFile(pathname: string) {
  const aliases = invoiceAnalysisAliases(pathname)

  for (const alias of aliases) {
    try {
      const result = await getClient().send(new HeadObjectCommand({
        Bucket: getConfig().bucket,
        Key: storageKey(alias),
      }))

      return {
        pathname: alias,
        contentType: result.ContentType ?? "application/octet-stream",
        etag: result.ETag ?? undefined,
        size: result.ContentLength ?? undefined,
      }
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error
      }
    }
  }

  return null
}

export async function deleteFile(pathname: string) {
  await getClient().send(new DeleteObjectCommand({
    Bucket: getConfig().bucket,
    Key: storageKey(pathname),
  }))
}

export async function listFiles() {
  const config = getConfig()
  let continuationToken: string | undefined
  const objects: Array<{ pathname: string; size: number }> = []

  do {
    const result = await getClient().send(new ListObjectsV2Command({
      Bucket: config.bucket,
      Prefix: config.basePrefix ? `${config.basePrefix}/` : undefined,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    }))

    for (const object of result.Contents ?? []) {
      if (!object.Key) continue
      objects.push(toListedFile(object, config.basePrefix))
    }

    continuationToken = result.NextContinuationToken
  } while (continuationToken)

  return objects
}

function toListedFile(object: _Object, basePrefix: string) {
  const key = object.Key ?? ""
  const pathname = basePrefix && key.startsWith(`${basePrefix}/`)
    ? key.slice(basePrefix.length + 1)
    : key

  return {
    pathname,
    size: object.Size ?? 0,
  }
}
