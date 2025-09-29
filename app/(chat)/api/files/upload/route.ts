import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { uploadToAzureBlob } from "@/lib/azure-blob";

const TEXT_FILE_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".py",
  ".js",
  ".ts",
  ".html",
  ".css",
  ".json",
  ".csv",
  ".xml",
  ".yaml",
  ".yml",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
]);

// Use Blob instead of File since File is not available in Node.js environment
const FileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= 5 * 1024 * 1024, {
      message: "File size should be less than 5MB",
    })
    // Update the file type based on the kind of files you want to accept
    .refine(
      (file) => {
        // Get the original file from FormData to access the name
        const allowedTypes = [
          // Images
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/webp",
          "image/svg+xml",
          "image/bmp",
          "image/tiff",
          // Documents
          "application/pdf",
          "text/markdown",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-powerpoint",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          // Code/Data
          "application/json",
          "text/csv",
          "application/xml",
          "text/xml",
          "application/x-yaml",
          "text/yaml",
          "text/javascript",
          "text/typescript",
          "text/html",
          "text/css",
          "text/x-python",
          "application/x-python-code",
          "text/x-c",
          "text/x-c++src",
          "text/x-c++hdr",
          "text/x-chdr",
          "text/x-c++",
          "text/cpp",
          "text/x-cpp",
          "application/x-cpp",
          "application/octet-stream", // Binary files, need extension validation
        ];

        // If it's a known MIME type, allow it
        if (allowedTypes.includes(file.type)) {
          return true;
        }

        // If it's text/plain or octet-stream, check the file extension
        if (
          file.type === "text/plain" ||
          file.type === "application/octet-stream"
        ) {
          // We need to get the filename from somewhere - this will be handled in the main validation
          return true; // We'll validate extension in the main function
        }

        return false;
      },
      {
        message:
          "File type not supported. Supported types: Images (JPEG, PNG, GIF, WebP, SVG, BMP, TIFF), Documents (PDF, TXT, MD, DOC, XLS, PPT), Code/Data files (JSON, CSV, XML, YAML, JS, TS, HTML, CSS, Python, C, C++)",
      }
    ),
});

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (request.body === null) {
    return new Response("Request body is empty", { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as Blob;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Get filename for logging
    const filename = (formData.get("file") as File).name;

    // Log file details for debugging
    console.log("🔍 File upload debug info:", {
      filename,
      mimeType: file.type,
      size: file.size,
      fileExtension: filename
        .toLowerCase()
        .substring(filename.lastIndexOf(".")),
    });

    const validatedFile = FileSchema.safeParse({ file });

    if (!validatedFile.success) {
      const errorMessage = validatedFile.error.errors
        .map((error) => error.message)
        .join(", ");

      console.log("❌ File validation failed:", {
        filename,
        mimeType: file.type,
        errors: validatedFile.error.errors,
        errorMessage,
      });

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    // Additional validation for text/plain and octet-stream files - check file extension
    if (
      file.type === "text/plain" ||
      file.type === "application/octet-stream"
    ) {
      console.log(`📝 Processing ${file.type} file, checking extension...`);

      const fileExtension = filename
        .toLowerCase()
        .substring(filename.lastIndexOf("."));
      console.log("🔍 Extension check:", {
        fileExtension,
        allowedExtensions: Array.from(TEXT_FILE_EXTENSIONS),
        isAllowed: TEXT_FILE_EXTENSIONS.has(fileExtension),
      });

      if (!TEXT_FILE_EXTENSIONS.has(fileExtension)) {
        console.log(`❌ Extension not allowed for ${file.type} file`);
        return NextResponse.json(
          {
            error: `File type not supported. For code/text files, supported extensions are: ${Array.from(
              TEXT_FILE_EXTENSIONS
            ).join(", ")}`,
          },
          { status: 400 }
        );
      }
      console.log(`✅ Extension check passed for ${file.type} file`);
    }
    const fileBuffer = await file.arrayBuffer();

    try {
      // Convert certain file types to supported MIME types for AI processing
      let finalContentType = file.type || "application/octet-stream";

      // Handle text-based files that aren't directly supported by AI models
      const textBasedExtensions = [
        ".html",
        ".css",
        ".js",
        ".ts",
        ".cpp",
        ".c",
        ".h",
        ".hpp",
        ".py",
        ".md",
        ".json",
        ".yaml",
        ".yml",
        ".xml",
      ];
      const fileExtension = filename
        .toLowerCase()
        .substring(filename.lastIndexOf("."));

      if (
        file.type === "text/html" ||
        file.type === "text/css" ||
        file.type === "text/javascript" ||
        file.type === "application/javascript" ||
        (file.type === "application/octet-stream" &&
          textBasedExtensions.includes(fileExtension))
      ) {
        // Convert to text/plain for AI processing
        finalContentType = "text/plain";
        console.log(
          `🔄 Converting ${file.type} to text/plain for AI compatibility`
        );
      }

      const data = await uploadToAzureBlob(filename, fileBuffer, {
        contentType: finalContentType,
      });

      console.log("✅ File uploaded successfully:", {
        filename,
        mimeType: file.type,
        finalContentType,
        uploadedUrl: data.url,
      });

      // Return the final content type that will be used for AI processing
      return NextResponse.json({
        url: data.url,
        pathname: data.pathname,
        contentType: finalContentType, // Use the converted content type
      });
    } catch (error) {
      console.error("Upload error:", error);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
  } catch (_error) {
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
