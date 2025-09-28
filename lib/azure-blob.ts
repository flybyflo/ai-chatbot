import { BlobServiceClient } from "@azure/storage-blob";

function createBlobServiceClient(): BlobServiceClient {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;

  if (connectionString) {
    return BlobServiceClient.fromConnectionString(connectionString);
  }

  if (accountName) {
    // For production, you'd typically use DefaultAzureCredential for managed identity
    // For now, we'll use connection string approach
    throw new Error("AZURE_STORAGE_CONNECTION_STRING is required");
  }

  throw new Error(
    "Either AZURE_STORAGE_CONNECTION_STRING or AZURE_STORAGE_ACCOUNT_NAME is required"
  );
}

export async function uploadToAzureBlob(
  filename: string,
  fileBuffer: ArrayBuffer,
  options: {
    containerName?: string;
    contentType?: string;
  } = {}
): Promise<{
  url: string;
  pathname: string;
  contentType: string;
}> {
  const blobServiceClient = createBlobServiceClient();
  const containerName = options.containerName || process.env.AZURE_STORAGE_CONTAINER_NAME || "upload";

  // Get container client and create container if it doesn't exist
  const containerClient = blobServiceClient.getContainerClient(containerName);

  try {
    await containerClient.createIfNotExists({
      access: "blob", // Public access for blobs
    });
  } catch (error) {
    console.warn("Failed to create container, it might already exist:", error);
  }

  // Generate unique filename with timestamp
  const timestamp = Date.now();
  const blobName = `${timestamp}-${filename}`;

  // Get blob client
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  // Upload the file
  const uploadOptions = {
    blobHTTPHeaders: {
      blobContentType: options.contentType || "application/octet-stream",
    },
  };

  await blockBlobClient.upload(fileBuffer, fileBuffer.byteLength, uploadOptions);

  return {
    url: blockBlobClient.url,
    pathname: blobName,
    contentType: options.contentType || "application/octet-stream",
  };
}