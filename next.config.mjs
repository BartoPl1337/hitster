/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfkit + fontkit używają legacy decoratorów których Turbopack nie ogarnia
  // w bundlu. Sharp ma natywne binaria — też lepiej external.
  serverExternalPackages: ["pdfkit", "fontkit", "sharp"],
}

export default nextConfig
